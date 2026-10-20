package ninja.domi.cloudhoist.engine

import androidx.work.WorkInfo
import org.junit.Assert.assertEquals
import org.junit.Test

class QueueDrainStatusTest {
  @Test
  fun missingWorkIsStoppedRatherThanWaitingForAndroid() {
    assertEquals(mapOf("state" to "stopped", "reason" to "Uploads stopped"), QueueDrainStatus().workerMap(100))
  }

  @Test
  fun distinguishesScheduledStartingAndDependentWork() {
    assertEquals("Uploads scheduled", reason(WorkInfo.State.ENQUEUED))
    assertEquals("Starting uploads", reason(WorkInfo.State.RUNNING))
    assertEquals("Waiting for the previous upload task to finish", reason(WorkInfo.State.BLOCKED))
  }

  @Test
  fun reportsAndroidStopReasonWithoutCallingItAUserPause() {
    val work = QueueDrainStatus(state = WorkInfo.State.ENQUEUED, stopReason = WorkInfo.STOP_REASON_QUOTA)
    assertEquals("Android stopped uploads: background time limit reached", work.workerMap(100)["reason"])
  }

  @Test
  fun distinguishesFutureBackoffFromWorkAlreadyEligibleToRun() {
    val work = QueueDrainStatus(state = WorkInfo.State.ENQUEUED, nextScheduleTimeMillis = 200)
    assertEquals("Waiting for Android's automatic retry", work.workerMap(100)["reason"])
    assertEquals("Uploads scheduled", work.workerMap(300)["reason"])
  }

  private fun reason(state: WorkInfo.State) = QueueDrainStatus(state = state).workerMap(100)["reason"]
}
