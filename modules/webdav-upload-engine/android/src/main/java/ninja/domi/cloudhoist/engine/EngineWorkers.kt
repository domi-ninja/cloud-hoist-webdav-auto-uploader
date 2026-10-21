package ninja.domi.cloudhoist.engine

import android.content.Context
import android.app.ActivityManager
import android.app.ForegroundServiceStartNotAllowedException
import android.os.Build
import androidx.work.ListenableWorker
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.locks.ReentrantLock

private val scanLock = ReentrantLock()

private inline fun runOneScan(
  block: () -> ListenableWorker.Result,
): ListenableWorker.Result {
  if (!scanLock.tryLock()) return ListenableWorker.Result.success()
  return try {
    block()
  } finally {
    scanLock.unlock()
  }
}

class MediaObserverWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result {
    return runOneScan {
      val preferences = EnginePreferences(applicationContext)
      preferences.scanStarted("media")
      try {
        val scan = EngineScanRunner.create(applicationContext).scanMedia()
        if (scan.incomplete) {
          preferences.workerIdle()
          Result.retry()
        } else {
          preferences.scanCompleted()
          Result.success()
        }
      } catch (_: Exception) {
        preferences.workerIdle()
        Result.retry()
      }
    }.also { EngineWorkScheduler(applicationContext).rearmMediaObserver() }
  }
}

class ReconciliationWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result = runOneScan {
    val preferences = EnginePreferences(applicationContext)
    preferences.scanStarted("all")
    try {
      val scan = EngineScanRunner.create(applicationContext).reconcile()
      if (scan.incomplete) {
        preferences.workerIdle()
        Result.retry()
      } else {
        preferences.scanCompleted()
        Result.success()
      }
    } catch (_: Exception) {
      preferences.workerIdle()
      Result.retry()
    }
  }
}

class QueueDrainWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result {
    val dao = EngineRoomDatabase.open(applicationContext).engineDao()
    val queueCount = dao.pendingWorkCount()
    val process = ActivityManager.RunningAppProcessInfo().also(ActivityManager::getMyMemoryState)
    val notification = if (queueCount > 0 && mayPromoteUploadWorker(Build.VERSION.SDK_INT, process.importance)) {
      val candidate = TransferNotification(applicationContext)
      if (!promoteUploadWorker { setForegroundAsync(candidate.foregroundInfo(dao.queueCounts())).get() }) {
        // Visibility can change between the check and promotion. WorkManager has already
        // marked this worker foreground; finish it before trying an ordinary background batch.
        EngineWorkScheduler(applicationContext).continueQueueDrain()
        return Result.success()
      }
      candidate
    } else {
      null
    }
    var lastNotificationUpdate = 0L
    val drain = QueueDrainRunner.create(
      context = applicationContext,
      isStopped = { isStopped },
      onProgress = {
        val now = android.os.SystemClock.elapsedRealtime()
        if (notification != null && now - lastNotificationUpdate >= 1_000) {
          notification.update(dao.queueCounts())
          lastNotificationUpdate = now
        }
      },
    ).run()
    notification?.update(dao.queueCounts())
    val credential = AndroidAccountRepository(applicationContext, dao).credential()
    val readmeUpdated = credential == null || PhoneUploadReadme().updateAfterSync(applicationContext, dao, credential)
    return when {
      drain.continueImmediately -> {
        EngineWorkScheduler(applicationContext).continueQueueDrain()
        Result.success()
      }
      drain.retryWorker || !readmeUpdated -> Result.retry()
      else -> Result.success()
    }
  }
}

/** Background batches fit the ordinary eight-minute worker budget and need no FGS. */
internal fun mayPromoteUploadWorker(sdk: Int, processImportance: Int): Boolean =
  sdk < 31 || processImportance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND

/** Recognize a visibility race, without swallowing unrelated startup errors. */
internal fun promoteUploadWorker(promote: () -> Unit): Boolean = try {
  promote()
  true
} catch (error: Exception) {
  if (Build.VERSION.SDK_INT >= 31 &&
    generateSequence(error as Throwable?) { it.cause }.any { it is ForegroundServiceStartNotAllowedException }
  ) false else throw error
}
