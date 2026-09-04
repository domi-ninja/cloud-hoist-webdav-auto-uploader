package ninja.domi.webdavautoupload.engine

import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.NetworkType
import androidx.work.WorkInfo
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
    val info = TransferNotification(context).foregroundInfo(queueCount = 2)

    assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC, info.foregroundServiceType)
    assertEquals("Pause", info.notification.actions.single().title)
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
