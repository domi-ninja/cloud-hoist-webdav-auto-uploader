package ninja.domi.webdavautoupload.engine

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
  private var lastPercent = -1
  private var lastFileName = ""

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

  fun foregroundInfo(queueCount: Int) = ForegroundInfo(
    NOTIFICATION_ID,
    notification(progress = null, queueCount),
    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
  )

  fun update(progress: TransferProgress, queueCount: Int) {
    val percent = transferPercent(progress.uploadedBytes, progress.totalBytes)
    val fileName = safeTransferFileName(progress.fileName)
    if (percent == lastPercent && fileName == lastFileName) return
    lastPercent = percent
    lastFileName = fileName
    notifications.notify(NOTIFICATION_ID, notification(progress, queueCount))
  }

  private fun notification(progress: TransferProgress?, queueCount: Int): Notification {
    val fileName = progress?.fileName?.let(::safeTransferFileName)
    val percent = progress?.let { transferPercent(it.uploadedBytes, it.totalBytes) }
    return NotificationCompat.Builder(appContext, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_upload)
      .setContentTitle("Uploading to Nextcloud")
      .setContentText(
        when {
          fileName != null && queueCount > 1 -> "$fileName · $queueCount queued"
          fileName != null -> fileName
          queueCount > 1 -> "$queueCount files queued"
          else -> "Preparing upload"
        },
      )
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setSilent(true)
      .setProgress(100, percent ?: 0, percent == null)
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
    const val CHANNEL_ID = "webdav_auto_upload_transfers"
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
