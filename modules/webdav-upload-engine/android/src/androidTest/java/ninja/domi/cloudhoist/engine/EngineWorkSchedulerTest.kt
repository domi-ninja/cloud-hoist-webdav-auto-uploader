package ninja.domi.cloudhoist.engine

import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.app.ForegroundServiceStartNotAllowedException
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.NetworkType
import androidx.work.WorkInfo
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EngineWorkSchedulerTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()
  private val workManager = WorkManager.getInstance(context)
  private val preferences = EnginePreferences(context)
  private val scheduler = EngineWorkScheduler(context, workManager, preferences)

  @Before
  fun clearEngineWork() {
    preferences.resume()
    preferences.setConstraints(TransferConstraints())
    workManager.cancelAllWorkByTag(EngineWorkScheduler.ENGINE_WORK_TAG).result.get()
    workManager.pruneWork().result.get()
  }

  @After
  fun cleanUpEngineWork() {
    workManager.cancelAllWorkByTag(EngineWorkScheduler.ENGINE_WORK_TAG).result.get()
  }

  @Test
  fun repeatedInitializationKeepsOneObserverAndOnePeriodicReconciliation() {
    scheduler.ensureScheduled()
    scheduler.ensureScheduled()

    assertEquals(1, activeWork(EngineWorkScheduler.MEDIA_OBSERVER_WORK).size)
    val reconciliation = activeWork(EngineWorkScheduler.RECONCILIATION_WORK)
    assertEquals(1, reconciliation.size)
    assertEquals(
      TimeUnit.MINUTES.toMillis(15),
      reconciliation.single().periodicityInfo!!.repeatIntervalMillis,
    )
  }

  @Test
  fun queueDrainIsUniqueAndUsesGlobalConstraints() {
    scheduler.requestQueueDrain()
    scheduler.requestQueueDrain()

    val work = activeWork(EngineWorkScheduler.QUEUE_DRAIN_WORK).single()
    assertEquals(work.state, scheduler.queueDrainStatus().state)
    assertEquals(NetworkType.UNMETERED, work.constraints.requiredNetworkType)
    assertTrue(work.constraints.requiresBatteryNotLow())
    assertTrue(!work.constraints.requiresCharging())
  }

  @Test
  fun changingConstraintsReplacesActiveDrainAndPauseCancelsIt() {
    scheduler.requestQueueDrain()
    scheduler.updateDrainConstraints(
      TransferConstraints(
        unmeteredOnly = false,
        batteryNotLow = false,
        requiresCharging = true,
      ),
    )

    val replacement = activeWork(EngineWorkScheduler.QUEUE_DRAIN_WORK).single()
    assertEquals(NetworkType.CONNECTED, replacement.constraints.requiredNetworkType)
    assertTrue(!replacement.constraints.requiresBatteryNotLow())
    assertTrue(replacement.constraints.requiresCharging())

    scheduler.pause()
    workManager.getWorkInfosForUniqueWork(EngineWorkScheduler.QUEUE_DRAIN_WORK).get()
    assertTrue(activeWork(EngineWorkScheduler.QUEUE_DRAIN_WORK).isEmpty())
    assertEquals(null, scheduler.queueDrainStatus().state)
  }

  @Test
  fun pausedStateSurvivesRecreationAndPreventsNewDrains() {
    scheduler.pause()

    EngineWorkScheduler(context, workManager, EnginePreferences(context)).requestQueueDrain()

    assertTrue(EnginePreferences(context).isPaused())
    assertTrue(activeWork(EngineWorkScheduler.QUEUE_DRAIN_WORK).isEmpty())
  }

  @Test
  fun notificationActionPausesActiveQueueWork() {
    scheduler.requestQueueDrain()

    PauseUploadsReceiver().onReceive(context, Intent())

    assertTrue(preferences.isPaused())
    assertTrue(activeWork(EngineWorkScheduler.QUEUE_DRAIN_WORK).isEmpty())
  }

  @Test
  fun transferForegroundInfoUsesDataSyncAndOffersPause() {
    val info = TransferNotification(context).foregroundInfo(QueueCounts(queued = 2, uploading = 0, failed = 0, uploaded = 5))

    assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC, info.foregroundServiceType)
    assertEquals("Pause", info.notification.actions.single().title)
  }

  @Test
  fun backgroundWorkersAvoidForegroundPromotion() {
    val foreground = android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    val background = android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED
    assertTrue(mayPromoteUploadWorker(30, background))
    assertTrue(mayPromoteUploadWorker(31, foreground))
    assertFalse(mayPromoteUploadWorker(31, background))
    assertFalse(mayPromoteUploadWorker(36, background))
  }

  @Test
  fun deniedForegroundPromotionIsRecognizedWithoutHidingOtherFailures() {
    assumeTrue(Build.VERSION.SDK_INT >= 31)
    assertFalse(promoteUploadWorker {
      throw java.util.concurrent.ExecutionException(ForegroundServiceStartNotAllowedException("background"))
    })
    assertTrue(promoteUploadWorker {})
    assertThrows(IllegalStateException::class.java) {
      promoteUploadWorker { error("unexpected failure") }
    }
  }

  @Test
  fun simultaneousManualScanRequestsStayUnique() {
    scheduler.requestFullScan()
    scheduler.requestFullScan()

    assertEquals(1, activeWork(EngineWorkScheduler.FULL_SCAN_WORK).size)
    assertTrue(preferences.status().lastScanRequestedAt != null)
  }

  private fun activeWork(name: String): List<WorkInfo> =
    workManager.getWorkInfosForUniqueWork(name).get().filterNot { it.state.isFinished }
}
