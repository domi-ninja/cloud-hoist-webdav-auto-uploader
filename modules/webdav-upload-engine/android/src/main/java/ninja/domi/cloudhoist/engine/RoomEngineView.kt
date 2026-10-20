package ninja.domi.cloudhoist.engine

import androidx.work.WorkInfo
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit

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
    waitingReason: String? = null,
    queueDrain: QueueDrainStatus = QueueDrainStatus(),
  ): Map<String, Any?> {
    val jobs = dao.recentJobViews()
    val blockers = blockers(account, jobs)
    val running = jobs.firstOrNull { it.state == JobState.RUNNING }
    val queue = dao.queueCounts()
    val sources = sources()
    val canEstimate = running != null && scheduler.pausedAt == null && blockers.isEmpty() &&
      waitingReason == null && queue.failed == 0 && sources.none { source ->
        val counts = source["queue"] as? Map<*, *>
        source["enabled"] == false && ((counts?.get("pending") as? Int) ?: 0) > 0
      }
    val confirmedBytes = running?.let { (it.chunkSize ?: 0) * (it.confirmedChunks?.size ?: 0) } ?: 0
    val remainingSeconds = if (canEstimate) estimateRemainingSeconds(
      (dao.remainingUploadBytes() - confirmedBytes).coerceAtLeast(0),
      dao.recentUploadTimings(now() - TimeUnit.MINUTES.toMillis(10)),
    ) else null
    return mapOf(
      "revision" to revision,
      "account" to account,
      "engine" to when {
        scheduler.pausedAt != null -> mapOf("state" to "paused", "pausedAt" to scheduler.pausedAt)
        blockers.isNotEmpty() -> mapOf("state" to "blocked", "blockerCount" to blockers.size)
        else -> mapOf("state" to "running")
      },
      "sources" to sources,
      "queue" to mapOf(
        "queued" to queue.queued,
        "uploading" to queue.uploading,
        "failed" to queue.failed,
        "uploaded" to queue.uploaded,
        "estimatedRemainingSeconds" to remainingSeconds,
      ),
      "recentJobs" to jobs.map(::jobMap),
      "blockers" to blockers,
      "worker" to workerMap(running, scheduler, waitingReason, queueDrain),
      "scheduler" to scheduler.toMap(),
    )
  }

  fun sources(): List<Map<String, Any?>> {
    val counts = dao.sourceQueueCounts().associateBy { it.sourceId }
    return dao.allSources().map { source ->
    mapOf(
      "id" to source.id,
      "name" to source.name,
      "kind" to source.kind,
      "localUri" to source.localUri,
      "remotePath" to source.remotePathSegments.joinToString("/", prefix = "/"),
      "enabled" to source.enabled,
      "collisionPolicy" to source.collisionPolicy,
      "lastScanAt" to source.lastScanAt?.let(::instant),
      "queue" to mapOf("pending" to (counts[source.id]?.pending ?: 0), "failed" to (counts[source.id]?.failed ?: 0)),
    )
    }
  }

  fun activityPage(offset: Int, pageSize: Int = ACTIVITY_PAGE_SIZE): Map<String, Any?> {
    require(offset >= 0) { "Activity offset cannot be negative." }
    require(pageSize in 1..MAX_ACTIVITY_PAGE_SIZE) { "Activity page size is invalid." }
    val attempts = dao.activityAttempts(
      cutoff = now() - ACTIVITY_RETENTION_MILLIS,
      limit = pageSize + 1,
      offset = offset,
    )
    val hasNextPage = attempts.size > pageSize
    return mapOf(
      "items" to attempts.take(pageSize).map(::activityMap),
      "nextOffset" to if (hasNextPage) offset + pageSize else null,
    )
  }

  fun unresolvedFailures(): List<Map<String, Any?>> = dao.unresolvedJobs()
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
        collisionPolicy = CollisionPolicy.fromValue(input.collisionPolicy).value,
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

  private fun activityMap(attempt: UploadAttemptEntity): Map<String, Any?> = mapOf(
    "id" to attempt.id,
    "type" to "upload",
    "message" to if (attempt.resultCode == "completed") {
      "Upload completed."
    } else {
      "Upload ${attempt.resultCode ?: "started"}."
    },
    "occurredAt" to instant(attempt.finishedAt ?: attempt.startedAt),
  )

  private fun workerMap(
    running: UploadJobView?,
    scheduler: SchedulerStatus,
    waitingReason: String?,
    queueDrain: QueueDrainStatus,
  ): Map<String, Any?> = when {
    running != null && queueDrain.state == WorkInfo.State.RUNNING -> mapOf(
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
    scheduler.pausedAt == null && dao.pendingWorkCount() > 0 -> when {
      queueDrain.state == null -> queueDrain.workerMap(now())
      waitingReason != null -> mapOf("state" to "waiting", "reason" to waitingReason)
      dao.eligibleJobCount(now()) == 0 && dao.nextRetryJob() != null -> mapOf(
        "state" to "waiting",
        "reason" to retryReason(dao.nextRetryJob()?.lastErrorCode),
      )
      else -> queueDrain.workerMap(now())
    }
    scheduler.pausedAt == null -> disabledFolderWait() ?: mapOf("state" to "idle")
    else -> mapOf("state" to "idle")
  }

  private fun disabledFolderWait(): Map<String, Any?>? {
    val pendingSources = dao.sourceQueueCounts().filter { it.pending > 0 }.map { it.sourceId }.toSet()
    val disabled = dao.allSources().filter { !it.enabled && it.id in pendingSources }
    if (disabled.isEmpty()) return null
    return mapOf(
      "state" to "waiting",
      "reason" to if (disabled.size == 1) {
        "${disabled.single().name} backup is disabled"
      } else {
        "${disabled.size} backup folders are disabled"
      },
    )
  }

  private fun retryReason(code: String?): String = when (code) {
    "network", "dns", "connection_refused" -> "Cannot reach Nextcloud · will retry automatically"
    "timeout" -> "Nextcloud did not respond · will retry automatically"
    "server" -> "Nextcloud server error · will retry automatically"
    "rate_limited" -> "Nextcloud is limiting uploads · will retry automatically"
    "remote_locked" -> "File is locked on Nextcloud · will retry automatically"
    else -> "Upload interrupted · will retry automatically"
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
    else -> "Upload failed ($code)."
  }

  companion object {
    private const val ACTIVITY_PAGE_SIZE = 20
    private const val MAX_ACTIVITY_PAGE_SIZE = 50
    private val ACTIVITY_RETENTION_MILLIS = TimeUnit.DAYS.toMillis(30)
  }
}
