package ninja.domi.webdavautoupload.engine

import android.os.Build
import java.time.Instant
import org.json.JSONObject

/** Builds a support snapshot from aggregates only; private identifiers never enter the report. */
class DiagnosticReportBuilder(
  private val dao: EngineDao,
  private val eventLog: DiagnosticEventLog,
  private val now: () -> Instant = Instant::now,
) {
  fun build(account: StoredAccount?, scheduler: SchedulerStatus): String {
    val jobs = dao.recentJobViews()
    val raw = JSONObject(
      mapOf(
        "schemaVersion" to 1,
        "generatedAt" to now().toString(),
        "app" to mapOf("name" to "WebDAV Auto Upload", "version" to "0.1.0"),
        "android" to mapOf("sdk" to Build.VERSION.SDK_INT),
        "account" to if (account == null) {
          mapOf("status" to "not_configured")
        } else {
          mapOf(
            "status" to "connected",
            "serverVersion" to account.capabilities.serverVersion,
            "chunkingSupported" to account.capabilities.chunkingSupported,
            "maxChunkSize" to account.capabilities.maxChunkSize,
          )
        },
        "engine" to mapOf(
          "sources" to dao.allSources().size,
          "queued" to dao.jobCountInStates(listOf(JobState.QUEUED, JobState.RETRY_WAIT)),
          "uploading" to dao.jobCountInStates(listOf(JobState.RUNNING)),
          "blocked" to dao.jobCountInStates(listOf(JobState.BLOCKED)),
          "completed" to dao.jobCountInStates(listOf(JobState.COMPLETED)),
          "blockerCodes" to jobs.mapNotNull(UploadJobView::lastErrorCode)
            .map(::safeCode)
            .distinct()
            .sorted(),
        ),
        "scheduler" to scheduler.toMap(),
        "events" to eventLog.events(),
      ),
    ).toString(2)
    return DiagnosticRedactor.redact(raw)
  }

  private fun safeCode(value: String) = value
    .lowercase()
    .takeIf { it.matches(Regex("[a-z0-9_]{1,64}")) }
    ?: "unexpected"
}

object DiagnosticRedactor {
  private val sensitiveHeaderLine = Regex(
    """(?im)(^\s*(?:authorization|cookie|set-cookie)\s*:\s*)[^\r\n]*""",
  )
  private val secretValue = Regex(
    """(?i)(\"?(?:authorization|password|token|secret|appPassword|fileName|localPath|remotePath)\"?\s*[:=]\s*)(\"[^\"]*\"|[^\s,}]+)""",
  )
  private val url = Regex("""(?i)https?://[^\"\s]+""")
  private val contentUri = Regex("""(?i)content://[^\"\s]+""")
  private val androidPath = Regex("""(?i)/(?:storage|sdcard|data)/[^\"\s]+""")

  fun redact(value: String): String = value
    .replace(sensitiveHeaderLine, "$1[redacted]")
    .replace(secretValue, "$1\"[redacted]\"")
    .replace(url, "[redacted-url]")
    .replace(contentUri, "[redacted-uri]")
    .replace(androidPath, "[redacted-path]")
}
