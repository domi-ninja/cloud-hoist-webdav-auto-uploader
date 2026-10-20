package ninja.domi.cloudhoist.engine

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.AtomicFile
import androidx.work.WorkManager
import androidx.work.WorkInfo
import java.io.File
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import org.json.JSONObject

/** Test-only control of the production discovery/WorkManager pipeline; never fakes job results. */
class DebugStressAcceptance(private val context: Context) {
  private val database = EngineRoomDatabase.open(context)
  private val dao = database.engineDao()
  private val repository = AndroidAccountRepository(context, dao)
  private val scheduler = EngineWorkScheduler(context)

  fun call(method: String, run: String): Bundle {
    require(run.matches(Regex("stress-[a-z0-9-]+")))
    val tree = "content://ninja.domi.cloudhoist.stress-documents/tree/$run"
    when (method) {
      "stressSetup" -> {
        scheduler.pause()
        require(dao.allSources().isEmpty()) { "Stress setup requires a clean install" }
        context.contentResolver.takePersistableUriPermission(Uri.parse(tree), Intent.FLAG_GRANT_READ_URI_PERMISSION)
        val manager = SourceDiscoveryManager(repository, SourceRevisionRecorder(dao), AndroidMediaStoreDiscovery(context), DocumentTreeDiscovery(AndroidDocumentTreeGateway(context)))
        manager.commit(SourceCommit(id = run, name = "Stress photos", selection = SourceSelection(SourceType.DOCUMENT_TREE, tree), remotePathSegments = listOf(run)))
        scheduler.ensureScheduled()
        startStatusMonitor(run)
      }
      "stressResume" -> { scheduler.resume(); startStatusMonitor(run) }
      "stressRetry" -> { dao.retryEligibleFailures(); scheduler.requestQueueDrain() }
      "stressCleanup" -> {
        synchronized(monitorLock) {
          monitor?.cancel(false)
          monitor = null
          context.getSharedPreferences(MONITOR_PREFS, Context.MODE_PRIVATE).edit().clear().commit()
          AtomicFile(statusFile(run)).delete()
        }
        scheduler.pause()
        scheduler.cancelAll()
        if (dao.source(run) != null) dao.removeSource(run)
        runCatching { context.contentResolver.releasePersistableUriPermission(Uri.parse(tree), Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        EnginePreferences(context).resume()
      }
      "stressStatus" -> Unit
      else -> error("Unknown stress method")
    }
    return status()
  }

  private fun status(): Bundle {
    val work = WorkManager.getInstance(context).getWorkInfosForUniqueWork(EngineWorkScheduler.QUEUE_DRAIN_WORK).get(10, TimeUnit.SECONDS)
    return database.runInTransaction(Callable { Bundle().apply {
      putBoolean("workerFailed", work.none { !it.state.isFinished } && work.any { it.state == WorkInfo.State.FAILED })
      putString("status", "ok")
      putInt("queued", dao.jobCountInStates(listOf(JobState.QUEUED)))
      putInt("running", dao.jobCountInStates(listOf(JobState.RUNNING)))
      putInt("completed", dao.jobCountInStates(listOf(JobState.COMPLETED)))
      putInt("retrying", dao.jobCountInStates(listOf(JobState.RETRY_WAIT)))
      putInt("blocked", dao.jobCountInStates(listOf(JobState.BLOCKED)))
      putString("errors", dao.unresolvedJobs().mapNotNull { it.lastErrorCode }.distinct().joinToString("|"))
    } })
  }

  private fun statusFile(run: String) = File(requireNotNull(context.getExternalFilesDir(null)), "stress-status-$run.json")

  /** ADB reads this file without binding the app and temporarily granting background network access. */
  private fun startStatusMonitor(run: String) = synchronized(monitorLock) {
    context.getSharedPreferences(MONITOR_PREFS, Context.MODE_PRIVATE).edit().putString("run", run).commit()
    monitor?.cancel(false)
    monitor = executor.scheduleWithFixedDelay({
      synchronized(monitorLock) {
        if (context.getSharedPreferences(MONITOR_PREFS, Context.MODE_PRIVATE).getString("run", null) == run) {
          val snapshot = try {
            val counts = status()
            JSONObject().apply { counts.keySet().forEach { put(it, counts.get(it)) } }
          } catch (error: Exception) {
            JSONObject().put("monitorError", error.javaClass.simpleName)
          }
          snapshot.put("capturedAt", System.currentTimeMillis())
          val file = AtomicFile(statusFile(run))
          val stream = file.startWrite()
          try {
            stream.write(snapshot.toString().toByteArray(Charsets.UTF_8))
            file.finishWrite(stream)
          } catch (error: Exception) {
            file.failWrite(stream)
          }
        }
      }
    }, 0, 5, TimeUnit.SECONDS)
  }

  companion object {
    private const val MONITOR_PREFS = "debug-stress-monitor"
    private val monitorLock = Any()
    private val executor = Executors.newSingleThreadScheduledExecutor { task ->
      Thread(task, "stress-status").apply { isDaemon = true }
    }
    private var monitor: ScheduledFuture<*>? = null

    fun resumeStatusMonitor(context: Context) {
      val run = context.getSharedPreferences(MONITOR_PREFS, Context.MODE_PRIVATE).getString("run", null) ?: return
      if (run.matches(Regex("stress-[a-z0-9-]+"))) DebugStressAcceptance(context).startStatusMonitor(run)
    }
  }
}
