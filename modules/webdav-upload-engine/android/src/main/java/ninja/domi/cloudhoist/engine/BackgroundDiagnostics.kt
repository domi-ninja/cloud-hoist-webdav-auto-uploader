package ninja.domi.cloudhoist.engine

import android.app.ActivityManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import androidx.work.WorkManager
import io.sentry.Sentry
import io.sentry.SentryEvent
import io.sentry.SentryLevel
import io.sentry.protocol.Message
import io.sentry.protocol.SentryException
import io.sentry.protocol.SentryStackTrace
import io.sentry.protocol.SentryStackFrame
import io.sentry.protocol.Mechanism
import java.time.Instant
import java.util.concurrent.TimeUnit

/** Aggregate scheduler evidence only. Never attach exceptions' messages or user content. */
class BackgroundDiagnostics(private val context: Context) {
  fun report(reason: Reason, error: Throwable? = null, stopReason: Int? = null) {
    if (!Sentry.isEnabled()) return
    runCatching {
      val preferences = context.getSharedPreferences("background_diagnostics", Context.MODE_PRIVATE)
      val now = System.currentTimeMillis()
      // Keep startup evidence and failures; healthy workers send at most one heartbeat a day.
      synchronized(REPORT_LOCK) {
        val interval = if (reason == Reason.SCAN_COMPLETED || reason == Reason.DRAIN_COMPLETED)
          TimeUnit.DAYS.toMillis(1) else TimeUnit.MINUTES.toMillis(15)
        if (now - preferences.getLong(reason.name, 0) < interval) return
        preferences.edit().putLong(reason.name, now).apply()
      }
      val status = EnginePreferences(context).status()
      val power = context.getSystemService(PowerManager::class.java)
      val workers = WorkManager.getInstance(context)
      val event = SentryEvent().apply {
        logger = LOGGER
        message = Message().apply { formatted = reason.name }
        level = when {
          error != null -> SentryLevel.ERROR
          reason in setOf(Reason.DRAIN_FAILED, Reason.WORKER_STOPPED, Reason.METADATA_RETRY) -> SentryLevel.WARNING
          else -> SentryLevel.INFO
        }
        setTag("reason", reason.name)
        setExtra("workerStopReason", stopReason)
        setExtra("observedAt", Instant.ofEpochMilli(now).toString())
        setExtra("sdk", Build.VERSION.SDK_INT)
        setExtra("manufacturer", Build.MANUFACTURER)
        setExtra("batteryExempt", power.isIgnoringBatteryOptimizations(context.packageName))
        val activityManager = context.getSystemService(ActivityManager::class.java)
        setExtra("backgroundRestricted", activityManager.isBackgroundRestricted)
        if (Build.VERSION.SDK_INT >= 30) {
          activityManager.getHistoricalProcessExitReasons(context.packageName, 0, 1).firstOrNull()?.let { exit ->
            setExtra("lastProcessExit", mapOf(
              "reason" to exit.reason,
              "timestamp" to exit.timestamp,
              "importance" to exit.importance,
            ))
          }
        }
        setExtra("deviceIdle", power.isDeviceIdleMode)
        setExtra("powerSave", power.isPowerSaveMode)
        setExtra("standbyBucket", context.getSystemService(UsageStatsManager::class.java).appStandbyBucket)
        setExtra("lastAutomaticScan", preferences.getString("lastAutomaticScan", null))
        setExtra("lastScanCompleted", status.lastScanCompletedAt)
        setExtra("paused", status.pausedAt != null)
        setExtra("transferRules", mapOf(
          "unmeteredOnly" to status.constraints.unmeteredOnly,
          "batteryNotLow" to status.constraints.batteryNotLow,
          "requiresCharging" to status.constraints.requiresCharging,
        ))
        setExtra("waitingReason", TransferConstraintChecker(context).waitingReason())
        val dao = EngineRoomDatabase.open(context).engineDao()
        setExtra("pendingJobs", dao.pendingWorkCount())
        setExtra("uploadErrorCodes", dao.recentJobViews().mapNotNull { it.lastErrorCode }
          .filter { it.matches(Regex("[a-z0-9_]{1,64}")) }.distinct().take(20))
        for (name in WORK_NAMES) {
          val active = workers.getWorkInfosForUniqueWork(name).get(2, TimeUnit.SECONDS)
            .filterNot { it.state.isFinished }
          setExtra(name, active.take(4).map { work ->
            mapOf(
              "state" to work.state.name,
              "attempts" to work.runAttemptCount,
              "nextRun" to work.nextScheduleTimeMillis,
              "stopReason" to work.stopReason,
            )
          })
        }
        error?.let { throwable = it }
      }
      Sentry.captureEvent(event)
    }
  }

  fun automaticScanCompleted() {
    runCatching {
      context.getSharedPreferences("background_diagnostics", Context.MODE_PRIVATE).edit()
        .putString("lastAutomaticScan", Instant.now().toString()).apply()
    }
    report(Reason.SCAN_COMPLETED)
  }

  enum class Reason { APP_OPENED, SCAN_FAILED, SCAN_COMPLETED, DRAIN_FAILED, DRAIN_COMPLETED, WORKER_STOPPED, METADATA_RETRY }

  companion object {
    private const val LOGGER = "cloud-hoist.background"
    private val REPORT_LOCK = Any()
    private val WORK_NAMES = listOf(
      EngineWorkScheduler.MEDIA_OBSERVER_WORK, EngineWorkScheduler.RECONCILIATION_WORK,
      EngineWorkScheduler.QUEUE_DRAIN_WORK, EngineWorkScheduler.FULL_SCAN_WORK,
    )
    private val SAFE_EXTRAS = setOf(
      "lastProcessExit", "transferRules", "uploadErrorCodes", "workerStopReason", "observedAt", "sdk", "manufacturer", "batteryExempt", "backgroundRestricted", "deviceIdle",
      "powerSave", "standbyBucket", "lastAutomaticScan", "lastScanCompleted", "paused", "waitingReason", "pendingJobs",
    ) + WORK_NAMES

    /** Rebuild the event so SDK defaults cannot add device IDs, paths, headers or error messages. */
    internal fun sanitize(event: SentryEvent): SentryEvent = SentryEvent().apply {
      eventId = event.eventId
      timestamp = event.timestamp
      release = BuildConfig.APP_RELEASE
      environment = BuildConfig.APP_CHANNEL
      platform = "java"
      level = event.level
      logger = LOGGER
      val reason = event.getTag("reason")?.takeIf { value -> Reason.entries.any { it.name == value } }
      message = Message().apply { formatted = reason ?: "Unhandled native error" }
      reason?.let { setTag("reason", it) }
      if (reason != null && event.logger == LOGGER) {
        SAFE_EXTRAS.forEach { key -> event.getExtra(key)?.let { setExtra(key, it) } }
      }
      exceptions = event.exceptions?.map { original ->
        SentryException().apply {
          type = original.type
          module = original.module
          mechanism = original.mechanism?.let { source -> Mechanism().apply {
            type = source.type
            isHandled = source.isHandled
          } }
          stacktrace = original.stacktrace?.let { trace -> SentryStackTrace(trace.frames?.map { frame ->
            SentryStackFrame().apply {
              module = frame.module
              function = frame.function
              lineno = frame.lineno
              isInApp = frame.isInApp
            }
          }) }
        }
      }
    }
  }
}
