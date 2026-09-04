package ninja.domi.webdavautoupload.engine

import java.time.Instant
import java.util.UUID

/** Produces the bridge contract from the same Room state used by headless workers. */
class RoomEngineView(
  private val dao: EngineDao,
  private val onInvalidated: (Int) -> Unit,
  private val now: () -> Long = System::currentTimeMillis,
) {
  private var revision = 1

  @Synchronized
  fun invalidate() {
    revision += 1
    onInvalidated(revision)
  }

  @Synchronized
  fun snapshot(
    account: Map<String, Any?>,
    scheduler: SchedulerStatus,
  ): Map<String, Any?> {
    val jobs = dao.recentJobViews()
    val blockers = blockers(account, jobs)
    val running = jobs.firstOrNull { it.state == JobState.RUNNING }
    return mapOf(
      "revision" to revision,
      "account" to account,
      "engine" to when {
        scheduler.pausedAt != null -> mapOf("state" to "paused", "pausedAt" to scheduler.pausedAt)
        blockers.isNotEmpty() -> mapOf("state" to "blocked", "blockerCount" to blockers.size)
        else -> mapOf("state" to "running")
      },
      "sources" to sources(),
      "queue" to mapOf(
        "queued" to dao.jobCountInStates(listOf(JobState.QUEUED, JobState.RETRY_WAIT)),
        "uploading" to dao.jobCountInStates(listOf(JobState.RUNNING)),
        "failed" to dao.jobCountInStates(listOf(JobState.BLOCKED)),
        "uploaded" to dao.jobCountInStates(listOf(JobState.COMPLETED)),
      ),
      "recentJobs" to jobs.map(::jobMap),
      "blockers" to blockers,
      "worker" to workerMap(running, scheduler),
      "scheduler" to scheduler.toMap(),
    )
  }

  fun sources(): List<Map<String, Any?>> = dao.allSources().map { source ->
    mapOf(
      "id" to source.id,
      "name" to source.name,
      "kind" to source.kind,
      "localUri" to source.localUri,
      "remotePath" to source.remotePathSegments.joinToString("/", prefix = "/"),
      "enabled" to source.enabled,
      "lastScanAt" to source.lastScanAt?.let(::instant),
    )
  }

  fun recentActivity(): List<Map<String, Any?>> = dao.recentAttempts().map { attempt ->
    mapOf(
      "id" to attempt.id,
      "type" to "upload",
      "message" to if (attempt.resultCode == "completed") {
        "Upload completed."
      } else {
        "Upload ${attempt.resultCode ?: "started"}."
      },
      "occurredAt" to instant(attempt.finishedAt ?: attempt.startedAt),
    )
  }

  fun unresolvedFailures(): List<Map<String, Any?>> = dao.recentJobViews()
    .filter { it.state == JobState.BLOCKED || it.state == JobState.RETRY_WAIT }
    .map { job ->
      val code = job.lastErrorCode ?: "unknown"
      mapOf(
        "id" to "failure-${job.id}",
        "code" to code,
        "message" to failureMessage(code),
        "jobId" to job.id,
        "occurredAt" to instant(job.startedAt ?: job.createdAt),
        "retryable" to (job.state == JobState.RETRY_WAIT),
      )
    }

  fun addOrUpdateSource(input: SourceInputRecord, accountId: String) {
    if (input.name.isBlank()) throw EngineInvalidInputException("Source name is required.")
    if (input.kind !in setOf("media_store", "saf")) {
      throw EngineInvalidInputException("Source kind is invalid.")
    }
    val path = DavPath.validate(input.remotePath.split('/').filter(String::isNotBlank))
    val existing = input.id?.let(dao::source)
    dao.upsertSource(
      SourceEntity(
        id = input.id ?: UUID.randomUUID().toString(),
        accountId = accountId,
        name = input.name.trim(),
        kind = input.kind,
        localUri = input.localUri,
        remotePathSegments = path,
        enabled = input.enabled,
        createdAt = existing?.createdAt ?: now(),
        lastScanAt = existing?.lastScanAt,
        blockerCode = existing?.blockerCode,
      ),
    )
    invalidate()
  }

  fun removeSource(sourceId: String) {
    if (!dao.removeSource(sourceId)) throw EngineSourceNotFoundException(sourceId)
    invalidate()
  }

  fun resetSourceHistory(sourceId: String) {
    if (!dao.resetSourceHistory(sourceId)) throw EngineSourceNotFoundException(sourceId)
    invalidate()
  }

  fun retryFailed(): Int = dao.retryEligibleFailures().also {
    invalidate()
  }

  fun clearCompletedHistory(): Int = dao.deleteCompletedBefore(Long.MAX_VALUE).also {
    invalidate()
  }

  private fun blockers(
    account: Map<String, Any?>,
    jobs: List<UploadJobView>,
  ): List<Map<String, Any?>> = buildList {
    if (account["status"] == "not_configured") {
      add(
        mapOf(
          "kind" to "account",
          "code" to "not_configured",
          "message" to "Connect a Nextcloud account to begin uploading.",
        ),
      )
    }
    dao.blockedAccounts().forEach { blocked ->
      add(
        mapOf(
          "kind" to "account",
          "code" to if (blocked.blockerCode == "invalid_credentials") "unauthorized" else "unreachable",
          "message" to failureMessage(blocked.blockerCode ?: "account"),
        ),
      )
    }
    dao.blockedSources().forEach { source ->
      add(
        mapOf(
          "kind" to "permission",
          "sourceId" to source.id,
          "permission" to if (source.kind == "saf") "folder" else "media",
        ),
      )
    }
    jobs.filter { it.state == JobState.BLOCKED }.forEach { job ->
      val code = job.lastErrorCode ?: "blocked"
      add(
        mapOf(
          "kind" to "job",
          "jobId" to job.id,
          "code" to code,
          "message" to failureMessage(code),
        ),
      )
    }
    jobs.filter { it.state == JobState.RETRY_WAIT }.minByOrNull { it.retryAt ?: Long.MAX_VALUE }
      ?.let { waiting ->
        add(
          mapOf(
            "kind" to "network",
            "retryAt" to waiting.retryAt?.let(::instant),
          ),
        )
      }
  }

  private fun jobMap(job: UploadJobView): Map<String, Any?> = mapOf(
    "id" to job.id,
    "sourceId" to job.sourceId,
    "fileName" to job.remoteFileName,
    "byteCount" to job.byteCount,
    "state" to when (job.state) {
      JobState.QUEUED -> mapOf("status" to "queued")
      JobState.RUNNING -> mapOf(
        "status" to "uploading",
        "bytesSent" to confirmedBytes(job),
      )
      JobState.COMPLETED -> mapOf(
        "status" to "uploaded",
        "uploadedAt" to instant(job.completedAt ?: job.createdAt),
      )
      JobState.RETRY_WAIT -> mapOf(
        "status" to "failed",
        "code" to (job.lastErrorCode ?: "retry_wait"),
        "retryable" to true,
      )
      else -> mapOf(
        "status" to "failed",
        "code" to (job.lastErrorCode ?: job.state),
        "retryable" to false,
      )
    },
  )

  private fun workerMap(
    running: UploadJobView?,
    scheduler: SchedulerStatus,
  ): Map<String, Any?> = when {
    running != null -> mapOf(
      "state" to "uploading",
      "jobId" to running.id,
      "bytesSent" to confirmedBytes(running),
      "totalBytes" to running.byteCount,
    )
    scheduler.workerState == "scanning" &&
      scheduler.workerScope != null &&
      scheduler.lastScanRequestedAt != null -> mapOf(
        "state" to "scanning",
        "scope" to scheduler.workerScope,
        "startedAt" to scheduler.lastScanRequestedAt,
      )
    else -> mapOf("state" to "idle")
  }

  private fun confirmedBytes(job: UploadJobView): Long = minOf(
    job.byteCount,
    (job.chunkSize ?: 0L) * (job.confirmedChunks?.size ?: 0),
  )

  private fun instant(epochMillis: Long) = Instant.ofEpochMilli(epochMillis).toString()

  private fun failureMessage(code: String) = when (code) {
    "invalid_credentials" -> "Reconnect the Nextcloud account."
    "certificate" -> "Check the server certificate."
    "remote_permission" -> "Nextcloud denied access to the destination."
    "remote_missing" -> "The remote destination no longer exists."
    "quota" -> "Nextcloud storage is full."
    "local_missing" -> "The local file is no longer available."
    "local_invalid" -> "The local file cannot be uploaded."
    else -> "Upload paused after $code."
  }
}
