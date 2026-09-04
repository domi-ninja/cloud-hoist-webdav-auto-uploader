package ninja.domi.webdavautoupload.engine

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager

/** Rechecks mutable device state between files instead of trusting the worker's start state. */
class TransferConstraintChecker(
  context: Context,
  private val preferences: EnginePreferences = EnginePreferences(context),
) {
  private val appContext = context.applicationContext
  private val connectivity = appContext.getSystemService(ConnectivityManager::class.java)

  fun canStartNextFile(): Boolean {
    val constraints = preferences.constraints()
    val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork) ?: return false
    if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) return false
    if (
      constraints.unmeteredOnly &&
      !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    ) return false

    if (!constraints.batteryNotLow && !constraints.requiresCharging) return true
    val battery = appContext.registerReceiver(
      null,
      IntentFilter(Intent.ACTION_BATTERY_CHANGED),
    ) ?: return false
    if (
      constraints.batteryNotLow &&
      battery.getBooleanExtra(BatteryManager.EXTRA_BATTERY_LOW, false)
    ) return false
    if (constraints.requiresCharging) {
      val status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
      if (status != BatteryManager.BATTERY_STATUS_CHARGING &&
        status != BatteryManager.BATTERY_STATUS_FULL
      ) return false
    }
    return true
  }
}
