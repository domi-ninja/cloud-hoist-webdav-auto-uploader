package ninja.domi.webdavautoupload.engine

import android.content.Context
import java.io.File
import java.time.Instant
import java.util.concurrent.TimeUnit
import org.json.JSONObject

enum class DiagnosticEventCode(val value: String) {
  ENGINE_PAUSED("engine_paused"),
  ENGINE_RESUMED("engine_resumed"),
  SCAN_REQUESTED("scan_requested"),
  SOURCE_CHANGED("source_changed"),
  CONSTRAINTS_CHANGED("constraints_changed"),
  RETRY_REQUESTED("retry_requested"),
  HISTORY_CLEARED("history_cleared"),
  UPLOAD_COMPLETED("upload_completed"),
  UPLOAD_FAILED("upload_failed"),
}

private data class DiagnosticEvent(
  val occurredAt: Long,
  val code: DiagnosticEventCode,
  val resultCode: String?,
)

/** Stores only allowlisted event fields in app-private storage. Logging must never stop uploads. */
class DiagnosticEventLog(
  private val file: File,
  private val now: () -> Long = System::currentTimeMillis,
  private val maxBytes: Int = MAX_BYTES,
  private val retentionMillis: Long = RETENTION_MILLIS,
) {
  constructor(context: Context) : this(
    File(context.applicationContext.noBackupFilesDir, FILE_NAME),
  )

  fun record(code: DiagnosticEventCode) {
    append(DiagnosticEvent(now(), code, null))
  }

  fun recordUploadResult(resultCode: String) {
    val safeResult = safeResultCode(resultCode)
    val code = if (safeResult == "completed") {
      DiagnosticEventCode.UPLOAD_COMPLETED
    } else {
      DiagnosticEventCode.UPLOAD_FAILED
    }
    append(DiagnosticEvent(now(), code, safeResult))
  }

  fun events(): List<Map<String, Any?>> = runCatching {
    synchronized(FILE_LOCK) {
      load().map { event ->
        buildMap {
          put("occurredAt", Instant.ofEpochMilli(event.occurredAt).toString())
          put("code", event.code.value)
          event.resultCode?.let { put("resultCode", it) }
        }
      }
    }
  }.getOrDefault(emptyList())

  fun clear() {
    runCatching { synchronized(FILE_LOCK) { file.delete() } }
  }

  private fun append(event: DiagnosticEvent) {
    runCatching {
      synchronized(FILE_LOCK) {
        val retained = (load() + event).map(::encode).toMutableList()
        var byteCount = retained.sumOf(::encodedSize)
        while (byteCount > maxBytes && retained.isNotEmpty()) {
          byteCount -= encodedSize(retained.removeAt(0))
        }
        file.parentFile?.mkdirs()
        file.writeText(
          retained.joinToString(separator = "\n", postfix = if (retained.isEmpty()) "" else "\n"),
        )
      }
    }
  }

  private fun load(): List<DiagnosticEvent> {
    val cutoff = now() - retentionMillis
    if (!file.isFile) return emptyList()
    return file.useLines { lines ->
      lines.mapNotNull(::decode)
        .filter { it.occurredAt >= cutoff }
        .toList()
    }
  }

  private fun encode(event: DiagnosticEvent) = JSONObject(
    buildMap<String, Any> {
      put("occurredAt", event.occurredAt)
      put("code", event.code.value)
      event.resultCode?.let { put("resultCode", it) }
    },
  ).toString()

  private fun decode(line: String): DiagnosticEvent? = runCatching {
    val value = JSONObject(line)
    val code = DiagnosticEventCode.entries.single { it.value == value.getString("code") }
    val resultCode = if (value.has("resultCode")) {
      safeResultCode(value.getString("resultCode"))
    } else {
      null
    }
    DiagnosticEvent(value.getLong("occurredAt"), code, resultCode)
  }.getOrNull()

  private fun encodedSize(line: String) = line.toByteArray(Charsets.UTF_8).size + 1

  private fun safeResultCode(value: String) = value
    .lowercase()
    .takeIf { it.matches(SAFE_RESULT_CODE) }
    ?: "unexpected"

  private companion object {
    const val FILE_NAME = "diagnostic-events.jsonl"
    const val MAX_BYTES = 2 * 1024 * 1024
    val RETENTION_MILLIS = TimeUnit.DAYS.toMillis(7)
    val SAFE_RESULT_CODE = Regex("[a-z0-9_]{1,64}")
    val FILE_LOCK = Any()
  }
}
