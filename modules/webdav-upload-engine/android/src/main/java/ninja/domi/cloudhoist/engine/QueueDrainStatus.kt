package ninja.domi.cloudhoist.engine

import androidx.work.WorkInfo

/** Only report restrictions Android actually supplied; a scheduled time is not a start-time promise. */
data class QueueDrainStatus(
  val state: WorkInfo.State? = null,
  val nextScheduleTimeMillis: Long = Long.MAX_VALUE,
  val stopReason: Int = WorkInfo.STOP_REASON_NOT_STOPPED,
) {
  fun workerMap(now: Long): Map<String, Any?> {
    val reason = when (state) {
      WorkInfo.State.RUNNING -> "Starting uploads"
      WorkInfo.State.BLOCKED -> "Waiting for the previous upload task to finish"
      WorkInfo.State.ENQUEUED -> when (stopReason) {
        WorkInfo.STOP_REASON_QUOTA -> "Android stopped uploads: background time limit reached"
        WorkInfo.STOP_REASON_BACKGROUND_RESTRICTION -> "Android restricted this app's background activity"
        WorkInfo.STOP_REASON_APP_STANDBY -> "Android limited uploads while this app was inactive"
        WorkInfo.STOP_REASON_DEVICE_STATE -> "Android stopped uploads because of device restrictions"
        WorkInfo.STOP_REASON_TIMEOUT,
        WorkInfo.STOP_REASON_FOREGROUND_SERVICE_TIMEOUT -> "Android stopped uploads: upload time limit reached"
        else -> if (nextScheduleTimeMillis != Long.MAX_VALUE && nextScheduleTimeMillis > now) {
          "Waiting for Android's automatic retry"
        } else {
          "Uploads scheduled"
        }
      }
      else -> return mapOf("state" to "stopped", "reason" to "Uploads stopped")
    }
    return mapOf("state" to "waiting", "reason" to reason)
  }
}
