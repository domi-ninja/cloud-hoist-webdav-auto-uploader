package ninja.domi.cloudhoist.engine

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

class BlockerNotification(context: Context) {
  private val appContext = context.applicationContext
  private val notifications = appContext.getSystemService(NotificationManager::class.java)

  init {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notifications.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "Upload problems",
          NotificationManager.IMPORTANCE_DEFAULT,
        ).apply { description = "Problems that need attention before uploads can continue" },
      )
    }
  }

  fun show(job: UploadJobEntity, failure: TransferFailure) {
    val route = blockerDeepLink(job.id)
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(route))
      .setPackage(appContext.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val contentIntent = PendingIntent.getActivity(
      appContext,
      route.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(appContext, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_error)
      .setContentTitle("Upload failed: ${safeTransferFileName(job.remoteFileName)}")
      .setContentText(blockerNotificationMessage(failure.code))
      .setContentIntent(contentIntent)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .build()
    notifications.notify(NOTIFICATION_BASE_ID + job.id.hashCode().ushr(1) % 10_000, notification)
  }

  fun dismiss(jobId: String) {
    notifications.cancel(NOTIFICATION_BASE_ID + jobId.hashCode().ushr(1) % 10_000)
  }

  companion object {
    const val CHANNEL_ID = "cloud_hoist_attention"
    const val NOTIFICATION_BASE_ID = 8_000
  }
}

internal fun blockerDeepLink(jobId: String) = "cloud-hoist:///upload-failure?jobId=${java.net.URLEncoder.encode(jobId, "UTF-8")}"

internal fun blockerNotificationMessage(code: String) = when (code) {
  "invalid_credentials" -> "Reconnect your Nextcloud account."
  "certificate" -> "Check the Nextcloud server certificate."
  "remote_permission", "remote_missing" -> "Repair the upload destination."
  "local_missing" -> "Restore access to the local source."
  "quota" -> "Nextcloud storage is full."
  else -> "Open this file to review why the upload failed."
}
