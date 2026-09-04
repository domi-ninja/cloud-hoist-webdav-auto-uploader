package ninja.domi.webdavautoupload.engine

import expo.modules.kotlin.exception.CodedException
import java.time.Instant
import java.util.LinkedHashMap

class EngineSourceNotFoundException(sourceId: String) :
  CodedException("Source '$sourceId' was not found.")

class EngineInvalidInputException(message: String) : CodedException(message)

internal data class FixtureSource(
  val id: String,
  val name: String,
  val kind: String,
  val localUri: String,
  val remotePath: String,
  val enabled: Boolean,
  val lastScanAt: String?,
) {
  fun toMap() = mapOf(
    "id" to id,
    "name" to name,
    "kind" to kind,
    "localUri" to localUri,
    "remotePath" to remotePath,
    "enabled" to enabled,
    "lastScanAt" to lastScanAt,
  )
}

/** Deterministic state used only until durable repositories replace it. */
internal class FixtureUploadEngine(
  private val onInvalidated: (Int) -> Unit,
) {
  private var revision = 1
  private var pausedAt: String? = null
  private var scanCount = 0
  private var nextSourceId = 2
  private val sourceRecords = LinkedHashMap<String, FixtureSource>().apply {
    put(
      "source-1",
      FixtureSource(
        id = "source-1",
        name = "Camera",
        kind = "media_store",
        localUri = "content://media/external/images/media",
        remotePath = "/Photos/Camera",
        enabled = true,
        lastScanAt = null,
      ),
    )
  }
  private val activityRecords = mutableListOf<Map<String, Any?>>()

  @Synchronized
  fun snapshot(
    account: Map<String, Any?> = mapOf("status" to "not_configured"),
    scheduler: SchedulerStatus = SchedulerStatus(),
  ): Map<String, Any?> = mapOf(
    "revision" to revision,
    "account" to account,
    "engine" to if (scheduler.pausedAt == null) {
      mapOf("state" to "running")
    } else {
      mapOf("state" to "paused", "pausedAt" to scheduler.pausedAt)
    },
    "sources" to sources(),
    "queue" to mapOf(
      "queued" to scanCount,
      "uploading" to 0,
      "failed" to 0,
      "uploaded" to 0,
    ),
    "recentJobs" to emptyList<Map<String, Any?>>(),
    "blockers" to listOf(
      mapOf(
        "kind" to "account",
        "code" to "not_configured",
        "message" to "Connect a Nextcloud account to begin uploading.",
      ),
    ),
    "worker" to if (
      scheduler.workerState == "scanning" &&
      scheduler.workerScope != null &&
      scheduler.lastScanRequestedAt != null
    ) {
      mapOf(
        "state" to "scanning",
        "scope" to scheduler.workerScope,
        "startedAt" to scheduler.lastScanRequestedAt,
      )
    } else {
      mapOf("state" to "idle")
    },
    "scheduler" to scheduler.toMap(),
  )

  @Synchronized
  fun sources(): List<Map<String, Any?>> = sourceRecords.values.map(FixtureSource::toMap)

  @Synchronized
  fun recentActivity(): List<Map<String, Any?>> = activityRecords.toList()

  fun unresolvedFailures(): List<Map<String, Any?>> = emptyList()

  @Synchronized
  fun pause() {
    if (pausedAt == null) {
      pausedAt = Instant.now().toString()
      addActivity("pause", "Automatic uploads paused.")
      invalidate()
    }
  }

  @Synchronized
  fun resume() {
    if (pausedAt != null) {
      pausedAt = null
      addActivity("resume", "Automatic uploads resumed.")
      invalidate()
    }
  }

  @Synchronized
  fun scanNow() {
    scanCount += 1
    addActivity("scan", "Fixture scan queued $scanCount item(s).")
    invalidate()
  }

  @Synchronized
  fun retryFailed() {
    invalidate()
  }

  @Synchronized
  fun accountChanged() {
    invalidate()
  }

  @Synchronized
  fun schedulerChanged() {
    invalidate()
  }

  @Synchronized
  fun addOrUpdateSource(input: SourceInputRecord) {
    validate(input)
    val sourceId = input.id ?: "source-${nextSourceId++}"
    sourceRecords[sourceId] = FixtureSource(
      id = sourceId,
      name = input.name.trim(),
      kind = input.kind,
      localUri = input.localUri,
      remotePath = input.remotePath,
      enabled = input.enabled,
      lastScanAt = sourceRecords[sourceId]?.lastScanAt,
    )
    addActivity("source_changed", "Source '${input.name.trim()}' saved.")
    invalidate()
  }

  @Synchronized
  fun removeSource(sourceId: String) {
    if (sourceRecords.remove(sourceId) == null) {
      throw EngineSourceNotFoundException(sourceId)
    }
    addActivity("source_changed", "Source removed.")
    invalidate()
  }

  @Synchronized
  fun resetSourceHistory(sourceId: String) {
    val source = sourceRecords[sourceId] ?: throw EngineSourceNotFoundException(sourceId)
    sourceRecords[sourceId] = source.copy(lastScanAt = null)
    addActivity("source_changed", "Source history reset.")
    invalidate()
  }

  private fun validate(input: SourceInputRecord) {
    if (input.name.isBlank()) {
      throw EngineInvalidInputException("Source name is required.")
    }
    if (input.kind !in setOf("media_store", "saf")) {
      throw EngineInvalidInputException("Source kind is invalid.")
    }
    if (!input.remotePath.startsWith("/")) {
      throw EngineInvalidInputException("Remote path must start with '/'.")
    }
  }

  private fun addActivity(type: String, message: String) {
    activityRecords.add(
      0,
      mapOf(
        "id" to "activity-${revision + 1}",
        "type" to type,
        "message" to message,
        "occurredAt" to Instant.now().toString(),
      ),
    )
  }

  private fun invalidate() {
    revision += 1
    onInvalidated(revision)
  }
}
