package ninja.domi.webdavautoupload.engine

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class MediaObserverWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result {
    return try {
      val scan = EngineScanRunner.create(applicationContext).scanMedia()
      if (scan.incomplete) Result.retry() else Result.success()
    } catch (_: Exception) {
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
  override fun doWork(): Result = try {
    val scan = EngineScanRunner.create(applicationContext).reconcile()
    if (scan.incomplete) Result.retry() else Result.success()
  } catch (_: Exception) {
    Result.retry()
  }
}

class QueueDrainWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result = Result.success()
}
