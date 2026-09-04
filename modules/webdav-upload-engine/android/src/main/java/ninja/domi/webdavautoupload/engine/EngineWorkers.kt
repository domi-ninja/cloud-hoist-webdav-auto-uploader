package ninja.domi.webdavautoupload.engine

import android.content.Context
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
    val drain = QueueDrainRunner.create(applicationContext) { isStopped }.run()
    return if (drain.retryWorker) Result.retry() else Result.success()
  }
}
