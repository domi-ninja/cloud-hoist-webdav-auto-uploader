package ninja.domi.webdavautoupload.engine

import android.content.Context
import android.provider.MediaStore
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

data class TransferConstraints(
  val unmeteredOnly: Boolean = true,
  val batteryNotLow: Boolean = true,
  val requiresCharging: Boolean = false,
)

/** Owns the three process-persistent WorkManager registrations used by the engine. */
class EngineWorkScheduler(
  context: Context,
  private val workManager: WorkManager = WorkManager.getInstance(context),
  private val preferences: EnginePreferences = EnginePreferences(context),
) {
  fun ensureScheduled() {
    workManager.enqueueUniqueWork(
      MEDIA_OBSERVER_WORK,
      ExistingWorkPolicy.KEEP,
      OneTimeWorkRequestBuilder<MediaObserverWorker>()
        .setConstraints(mediaObserverConstraints())
        .addTag(ENGINE_WORK_TAG)
        .build(),
    )
    workManager.enqueueUniquePeriodicWork(
      RECONCILIATION_WORK,
      ExistingPeriodicWorkPolicy.UPDATE,
      PeriodicWorkRequestBuilder<ReconciliationWorker>(15, TimeUnit.MINUTES)
        .addTag(ENGINE_WORK_TAG)
        .build(),
    )
  }

  fun rearmMediaObserver() {
    workManager.enqueueUniqueWork(
      MEDIA_OBSERVER_WORK,
      ExistingWorkPolicy.APPEND_OR_REPLACE,
      OneTimeWorkRequestBuilder<MediaObserverWorker>()
        .setConstraints(mediaObserverConstraints())
        .addTag(ENGINE_WORK_TAG)
        .build(),
    )
  }

  fun requestQueueDrain(constraints: TransferConstraints = preferences.constraints()) {
    if (preferences.isPaused()) return
    workManager.enqueueUniqueWork(
      QUEUE_DRAIN_WORK,
      ExistingWorkPolicy.KEEP,
      queueDrainRequest(constraints),
    )
  }

  fun requestFullScan() {
    preferences.scanRequested()
    workManager.enqueueUniqueWork(
      FULL_SCAN_WORK,
      ExistingWorkPolicy.KEEP,
      OneTimeWorkRequestBuilder<ReconciliationWorker>()
        .addTag(ENGINE_WORK_TAG)
        .build(),
    )
  }

  fun updateDrainConstraints(constraints: TransferConstraints) {
    preferences.setConstraints(constraints)
    val current = workManager.getWorkInfosForUniqueWork(QUEUE_DRAIN_WORK).get()
    if (current.none { !it.state.isFinished }) return
    workManager.enqueueUniqueWork(
      QUEUE_DRAIN_WORK,
      ExistingWorkPolicy.REPLACE,
      queueDrainRequest(constraints),
    )
  }

  fun pause() {
    preferences.pause()
    workManager.cancelUniqueWork(QUEUE_DRAIN_WORK)
  }

  fun resume() {
    preferences.resume()
    ensureScheduled()
    requestQueueDrain()
  }

  private fun queueDrainRequest(settings: TransferConstraints) =
    OneTimeWorkRequestBuilder<QueueDrainWorker>()
      .setConstraints(
        Constraints.Builder()
          .setRequiredNetworkType(
            if (settings.unmeteredOnly) NetworkType.UNMETERED else NetworkType.CONNECTED,
          )
          .setRequiresBatteryNotLow(settings.batteryNotLow)
          .setRequiresCharging(settings.requiresCharging)
          .build(),
      )
      .addTag(ENGINE_WORK_TAG)
      .build()

  private fun mediaObserverConstraints() = Constraints.Builder()
    .addContentUriTrigger(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true)
    .addContentUriTrigger(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, true)
    .addContentUriTrigger(MediaStore.Files.getContentUri("external"), true)
    .setTriggerContentUpdateDelay(MEDIA_DEBOUNCE_SECONDS, TimeUnit.SECONDS)
    .setTriggerContentMaxDelay(MEDIA_MAX_DELAY_SECONDS, TimeUnit.SECONDS)
    .build()

  companion object {
    const val ENGINE_WORK_TAG = "webdav-auto-upload"
    const val MEDIA_OBSERVER_WORK = "media-observer"
    const val RECONCILIATION_WORK = "source-reconciliation"
    const val FULL_SCAN_WORK = "source-reconciliation-now"
    const val QUEUE_DRAIN_WORK = "queue-drain"
    const val MEDIA_DEBOUNCE_SECONDS = 10L
    const val MEDIA_MAX_DELAY_SECONDS = 30L
  }
}
