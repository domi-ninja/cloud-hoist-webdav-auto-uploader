package ninja.domi.webdavautoupload.engine

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class MediaObserverWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result {
    val preferences = EnginePreferences(applicationContext)
    preferences.scanStarted("media")
    return try {
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
    } finally {
      EngineWorkScheduler(applicationContext).rearmMediaObserver()
    }
  }
}

class ReconciliationWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result {
    val preferences = EnginePreferences(applicationContext)
    preferences.scanStarted("all")
    return try {
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
  override fun doWork(): Result = Result.success()
}
