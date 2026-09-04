package ninja.domi.webdavautoupload.engine

import android.content.Context
import java.time.Instant

data class SchedulerStatus(
  val pausedAt: String? = null,
  val lastScanRequestedAt: String? = null,
  val lastScanCompletedAt: String? = null,
  val workerState: String = "idle",
  val workerScope: String? = null,
  val constraints: TransferConstraints = TransferConstraints(),
) {
  fun toMap() = mapOf(
    "pausedAt" to pausedAt,
    "lastScanRequestedAt" to lastScanRequestedAt,
    "lastScanCompletedAt" to lastScanCompletedAt,
    "workerState" to workerState,
    "workerScope" to workerScope,
    "constraints" to mapOf(
      "unmeteredOnly" to constraints.unmeteredOnly,
      "batteryNotLow" to constraints.batteryNotLow,
      "requiresCharging" to constraints.requiresCharging,
    ),
  )
}

/** Small durable control plane shared by React Native and headless workers. */
class EnginePreferences(context: Context) {
  private val preferences = context.applicationContext.getSharedPreferences(
    PREFERENCES_NAME,
    Context.MODE_PRIVATE,
  )

  fun status() = SchedulerStatus(
    pausedAt = preferences.getString(KEY_PAUSED_AT, null),
    lastScanRequestedAt = preferences.getString(KEY_SCAN_REQUESTED_AT, null),
    lastScanCompletedAt = preferences.getString(KEY_SCAN_COMPLETED_AT, null),
    workerState = preferences.getString(KEY_WORKER_STATE, null) ?: "idle",
    workerScope = preferences.getString(KEY_WORKER_SCOPE, null),
    constraints = constraints(),
  )

  fun isPaused(): Boolean = preferences.contains(KEY_PAUSED_AT)

  fun pause(now: Instant = Instant.now()) {
    preferences.edit().putString(KEY_PAUSED_AT, now.toString()).apply()
  }

  fun resume() {
    preferences.edit().remove(KEY_PAUSED_AT).apply()
  }

  fun constraints() = TransferConstraints(
    unmeteredOnly = preferences.getBoolean(KEY_UNMETERED_ONLY, true),
    batteryNotLow = preferences.getBoolean(KEY_BATTERY_NOT_LOW, true),
    requiresCharging = preferences.getBoolean(KEY_REQUIRES_CHARGING, false),
  )

  fun setConstraints(value: TransferConstraints) {
    preferences.edit()
      .putBoolean(KEY_UNMETERED_ONLY, value.unmeteredOnly)
      .putBoolean(KEY_BATTERY_NOT_LOW, value.batteryNotLow)
      .putBoolean(KEY_REQUIRES_CHARGING, value.requiresCharging)
      .apply()
  }

  fun scanStarted(scope: String, now: Instant = Instant.now()) {
    preferences.edit()
      .putString(KEY_SCAN_REQUESTED_AT, now.toString())
      .putString(KEY_WORKER_STATE, "scanning")
      .putString(KEY_WORKER_SCOPE, scope)
      .apply()
  }

  fun scanRequested(now: Instant = Instant.now()) {
    preferences.edit().putString(KEY_SCAN_REQUESTED_AT, now.toString()).apply()
  }

  fun scanCompleted(now: Instant = Instant.now()) {
    preferences.edit()
      .putString(KEY_SCAN_COMPLETED_AT, now.toString())
      .putString(KEY_WORKER_STATE, "idle")
      .remove(KEY_WORKER_SCOPE)
      .apply()
  }

  fun workerIdle() {
    preferences.edit()
      .putString(KEY_WORKER_STATE, "idle")
      .remove(KEY_WORKER_SCOPE)
      .apply()
  }

  private companion object {
    const val PREFERENCES_NAME = "webdav_engine_preferences"
    const val KEY_PAUSED_AT = "pausedAt"
    const val KEY_SCAN_REQUESTED_AT = "lastScanRequestedAt"
    const val KEY_SCAN_COMPLETED_AT = "lastScanCompletedAt"
    const val KEY_WORKER_STATE = "workerState"
    const val KEY_WORKER_SCOPE = "workerScope"
    const val KEY_UNMETERED_ONLY = "unmeteredOnly"
    const val KEY_BATTERY_NOT_LOW = "batteryNotLow"
    const val KEY_REQUIRES_CHARGING = "requiresCharging"
  }
}
