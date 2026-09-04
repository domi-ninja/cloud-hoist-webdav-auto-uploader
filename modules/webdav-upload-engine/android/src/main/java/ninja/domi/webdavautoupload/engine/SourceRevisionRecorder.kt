package ninja.domi.webdavautoupload.engine

import java.util.UUID

data class DiscoveryRecordResult(
  val preview: SourcePreview,
  val revisionsAdded: Int,
  val jobsAdded: Int,
)

class SourceRevisionRecorder(
  private val dao: EngineDao,
  private val newId: () -> String = { UUID.randomUUID().toString() },
  private val now: () -> Long = System::currentTimeMillis,
) {
  fun record(
    source: SourceEntity,
    files: List<DiscoveredFile>,
    queueNewRevisions: Boolean,
    permissionAccess: MediaPermissionAccess? = null,
  ): DiscoveryRecordResult {
    val discoveredAt = now()
    val writes = files
      .sortedWith(compareBy(DiscoveredFile::modifiedAtEpochSeconds, DiscoveredFile::providerId))
      .map { file -> pendingWrite(source, file, queueNewRevisions, discoveredAt) }
    val counts = dao.recordDiscovery(
      source.copy(lastScanAt = discoveredAt, blockerCode = null),
      writes,
    )
    return DiscoveryRecordResult(
      preview = files.toSourcePreview(permissionAccess),
      revisionsAdded = counts.revisionsAdded,
      jobsAdded = counts.jobsAdded,
    )
  }

  private fun pendingWrite(
    source: SourceEntity,
    file: DiscoveredFile,
    queue: Boolean,
    discoveredAt: Long,
  ): PendingDiscoveryWrite {
    val relativeFilePath = (file.relativePathSegments + file.fileName).joinToString("/")
    val revisionId = newId()
    val revision = LocalRevisionEntity(
      id = revisionId,
      sourceId = source.id,
      providerId = file.providerId,
      localUri = file.localUri,
      relativePath = relativeFilePath,
      byteCount = file.byteCount,
      modifiedAt = file.modifiedAtEpochSeconds,
      discoveredAt = discoveredAt,
    )
    val job = if (queue) {
      UploadJobEntity(
        id = newId(),
        accountId = source.accountId,
        sourceId = source.id,
        revisionId = revisionId,
        remotePathSegments = source.remotePathSegments + file.relativePathSegments,
        remoteFileName = file.fileName,
        state = JobState.QUEUED,
        createdAt = file.modifiedAtEpochSeconds * 1_000,
        startedAt = null,
        completedAt = null,
        retryAt = null,
        attemptCount = 0,
        claimToken = null,
        blockerCode = null,
        lastErrorCode = null,
      )
    } else {
      null
    }
    return PendingDiscoveryWrite(revision, job)
  }
}
