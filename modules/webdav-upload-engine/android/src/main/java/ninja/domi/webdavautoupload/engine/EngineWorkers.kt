package ninja.domi.webdavautoupload.engine

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class MediaObserverWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result {
    EngineWorkScheduler(applicationContext).rearmMediaObserver()
    return Result.success()
  }
}

class ReconciliationWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result = Result.success()
}

class QueueDrainWorker(
  context: Context,
  parameters: WorkerParameters,
) : Worker(context, parameters) {
  override fun doWork(): Result = Result.success()
}
