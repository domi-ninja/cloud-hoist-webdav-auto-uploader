package ninja.domi.cloudhoist.engine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.ForegroundInfo

class TransferNotification(
  context: Context,
) {
  private val appContext = context.applicationContext
  private val notifications = appContext.getSystemService(NotificationManager::class.java)
  private val pauseIntent = PendingIntent.getBroadcast(
    appContext,
    0,
    Intent(appContext, PauseUploadsReceiver::class.java),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )
  private var lastProgress: OverallUploadProgress? = null

  init {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notifications.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "Uploads",
          NotificationManager.IMPORTANCE_LOW,
        ).apply {
          description = "Current WebDAV upload progress"
          setShowBadge(false)
        },
      )
    }
  }

  fun foregroundInfo(counts: QueueCounts) = ForegroundInfo(
    NOTIFICATION_ID,
    notification(overallUploadProgress(counts)),
    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
  )

  fun update(counts: QueueCounts) {
    val progress = overallUploadProgress(counts)
    if (progress == lastProgress) return
    lastProgress = progress
    notifications.notify(NOTIFICATION_ID, notification(progress))
  }

  private fun notification(progress: OverallUploadProgress): Notification {
    return NotificationCompat.Builder(appContext, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_upload)
      .setContentTitle("Uploading to Nextcloud")
      .setContentText("${progress.uploaded}/${progress.total} files uploaded")
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setSilent(true)
      .setProgress(progress.total.coerceAtLeast(1), progress.uploaded, false)
      .addAction(
        android.R.drawable.ic_menu_close_clear_cancel,
        "Pause",
        pauseIntent,
      )
      .apply {
        appContext.packageManager.getLaunchIntentForPackage(appContext.packageName)?.let { intent ->
          setContentIntent(
            PendingIntent.getActivity(
              appContext,
              0,
              intent,
              PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ),
          )
        }
      }
      .build()
  }

  companion object {
    const val CHANNEL_ID = "cloud_hoist_transfers"
    const val NOTIFICATION_ID = 7_201
  }
}

class PauseUploadsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    EngineWorkScheduler(context.applicationContext).pause()
  }
}

internal fun safeTransferFileName(value: String): String = value
  .filterNot(Char::isISOControl)
  .trim()
  .take(MAX_NOTIFICATION_FILE_NAME)
  .ifBlank { "File" }

internal fun transferPercent(uploadedBytes: Long, totalBytes: Long): Int {
  if (totalBytes <= 0) return 0
  return ((uploadedBytes.coerceIn(0, totalBytes) * 100) / totalBytes).toInt()
}

private const val MAX_NOTIFICATION_FILE_NAME = 80

data class OverallUploadProgress(val uploaded: Int, val total: Int)

internal fun overallUploadProgress(counts: QueueCounts) = OverallUploadProgress(
  counts.uploaded, counts.uploaded + counts.queued + counts.uploading + counts.failed,
)
