package ninja.domi.webdavautoupload.engine

import android.content.Context
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
    val queueCount = EngineRoomDatabase.open(applicationContext).engineDao()
      .pendingWorkCount()
    val notification = if (queueCount > 0) {
      val candidate = TransferNotification(applicationContext)
      if (promoteUploadWorker { setForegroundAsync(candidate.foregroundInfo(queueCount)).get() }) candidate else null
    } else {
      null
    }
    val drain = QueueDrainRunner.create(
      context = applicationContext,
      isStopped = { isStopped },
      onProgress = { progress -> notification?.update(progress, queueCount) },
    ).run()
    return when {
      drain.continueImmediately -> {
        EngineWorkScheduler(applicationContext).continueQueueDrain()
        Result.success()
      }
      drain.retryWorker -> Result.retry()
      else -> Result.success()
    }
  }
}

/** Android may deny notification-service promotion on a background retry.
 * The upload batch still fits the ordinary worker's time limit (eight minutes).
 */
internal fun promoteUploadWorker(promote: () -> Unit): Boolean = try {
  promote()
  true
} catch (error: Exception) {
  if (Build.VERSION.SDK_INT >= 31 &&
    generateSequence(error as Throwable?) { it.cause }.any { it is ForegroundServiceStartNotAllowedException }
  ) false else throw error
}
