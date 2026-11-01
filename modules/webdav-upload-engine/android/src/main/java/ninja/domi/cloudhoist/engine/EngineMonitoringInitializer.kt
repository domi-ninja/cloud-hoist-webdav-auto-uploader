package ninja.domi.cloudhoist.engine

import android.content.Context
import android.util.Log
import androidx.startup.Initializer
import io.sentry.android.core.SentryAndroid
import java.io.File

/** Starts in headless worker processes too, before any React Native module exists. */
class EngineMonitoringInitializer : Initializer<Unit> {
  override fun create(context: Context) {
    // Tests and local debug sessions do not report to the production project.
    if (BuildConfig.DEBUG || BuildConfig.SENTRY_DSN.isBlank()) return
    runCatching {
      SentryAndroid.init(context) { options ->
        options.setBeforeSend { event, _ ->
          BackgroundDiagnostics.sanitize(event).also {
            Log.i("CloudHoistDiagnostics", "GlitchTip event ${it.eventId}")
          }
        }
        options.dsn = BuildConfig.SENTRY_DSN
        options.release = BuildConfig.APP_RELEASE
        options.environment = BuildConfig.APP_CHANNEL
        options.isSendDefaultPii = false
        options.isEnableAutoSessionTracking = false
        options.isAttachThreads = false
        options.isSendClientReports = false
        options.isAnrEnabled = false
        options.isEnableNdk = false
        options.isTombstoneEnabled = false
        options.isAttachScreenshot = false
        options.isAttachViewHierarchy = false
        options.isCollectAdditionalContext = false
        options.isCollectExternalStorageContext = false
        options.isEnableRootCheck = false
        options.isEnableAutoActivityLifecycleTracing = false
        options.isEnableUserInteractionTracing = false
        options.isEnableFramesTracking = false
        options.isEnableScopeSync = false
        options.isEnablePerformanceV2 = false
        options.enableAllAutoBreadcrumbs(false)
        options.maxCacheItems = 20
        options.cacheDirPath = File(context.noBackupFilesDir, "glitchtip").absolutePath
        options.setBeforeBreadcrumb { _, _ -> null }
      }
    }.onFailure {
      // A monitoring setup failure must not prevent backups or app startup.
      Log.e("CloudHoistDiagnostics", "GlitchTip initialization failed")
    }
  }

  override fun dependencies(): List<Class<out Initializer<*>>> = emptyList()
}
