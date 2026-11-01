package ninja.domi.cloudhoist.engine

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings

/** Android exposes battery exemption and background restriction, but not Samsung's sleep lists. */
class BackgroundAccess(private val context: Context) {
  fun isUnrestricted(): Boolean = isBackgroundUnrestricted(
    context.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(context.packageName),
    context.getSystemService(ActivityManager::class.java).isBackgroundRestricted,
  )

  fun openSettings() {
    context.startActivity(
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
  }
}

internal fun isBackgroundUnrestricted(ignoresBatteryOptimizations: Boolean, backgroundRestricted: Boolean) =
  ignoresBatteryOptimizations && !backgroundRestricted
