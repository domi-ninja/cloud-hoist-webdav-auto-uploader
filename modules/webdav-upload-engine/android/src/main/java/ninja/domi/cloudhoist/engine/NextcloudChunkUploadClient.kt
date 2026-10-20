package ninja.domi.cloudhoist.engine

import java.util.UUID

interface ChunkCheckpointStore {
  fun load(jobId: String): ChunkCheckpointEntity?
  fun save(checkpoint: ChunkCheckpointEntity)
  fun delete(jobId: String)
}

fun interface ChunkedDavClient {
  fun upload(
    credential: StoredAccountCredential,
    jobId: String,
    request: DavUploadRequest,
  ): DavUploadResult?
}

class RoomChunkCheckpointStore(
  private val dao: EngineDao,
) : ChunkCheckpointStore {
  override fun load(jobId: String) = dao.chunkCheckpoint(jobId)

  override fun save(checkpoint: ChunkCheckpointEntity) = dao.upsertChunkCheckpoint(checkpoint)

  override fun delete(jobId: String) {
    dao.deleteChunkCheckpoint(jobId)
  }
}

/** Owns durable session reconciliation around the stateless v2 DAV transport. */
class NextcloudChunkUploadClient(
  private val checkpoints: ChunkCheckpointStore,
  private val transport: ChunkTransport,
  private val newUploadId: () -> String = { UUID.randomUUID().toString() },
  private val now: () -> Long = System::currentTimeMillis,
) : ChunkedDavClient {
  /** Returns null when this request should use the ordinary streaming client. */
  override fun upload(
    credential: StoredAccountCredential,
    jobId: String,
    request: DavUploadRequest,
  ): DavUploadResult? {
    val capabilities = credential.account.capabilities
    var checkpoint = checkpoints.load(jobId)
    val initialPlan = chunkPlan(
      request.byteCount,
      capabilities.chunkingSupported,
      capabilities.maxChunkSize,
    )
    if (initialPlan == null) {
      checkpoint?.let {
        transport.abortBestEffort(credential, it.uploadId, request)
        checkpoints.delete(jobId)
      }
      return null
    }
    if (request.isCancelled()) throw TransferCancelledException()

    return try {
      uploadChunked(credential, jobId, request, initialPlan, checkpoint)
    } catch (error: Exception) {
      if (!classifyTransferFailure(error).retryable) {
        checkpoints.load(jobId)?.let {
          transport.abortBestEffort(credential, it.uploadId, request)
          checkpoints.delete(jobId)
        }
      }
      throw error
    }
  }

  private fun uploadChunked(
    credential: StoredAccountCredential,
    jobId: String,
    request: DavUploadRequest,
    initialPlan: ChunkPlan,
    savedCheckpoint: ChunkCheckpointEntity?,
  ): DavUploadResult {
    val capabilities = credential.account.capabilities
    var checkpoint = savedCheckpoint
    var plan = checkpoint?.let {
      chunkPlan(
        request.byteCount,
        capabilities.chunkingSupported,
        capabilities.maxChunkSize,
        it.chunkSize,
      )
    }
    if (checkpoint != null && plan == null) {
      transport.abortBestEffort(credential, checkpoint.uploadId, request)
      checkpoints.delete(jobId)
      checkpoint = null
    }

    if (checkpoint != null) {
      val saved = checkpoint
      val savedPlan = checkNotNull(plan)
      val remoteChunks = transport.listChunks(credential, saved.uploadId, request)
      if (remoteChunks == null) {
        checkpoints.delete(jobId)
        checkpoint = null
        plan = null
      } else {
        val expectedNames = savedPlan.chunks.mapTo(mutableSetOf(), UploadChunk::name)
        val reconciled = remoteChunks.intersect(expectedNames).sorted()
        if (reconciled != saved.confirmedChunks) {
          checkpoint = saved.copy(confirmedChunks = reconciled, updatedAt = now())
          checkpoints.save(checkNotNull(checkpoint))
        }
      }
    }

    if (checkpoint == null) {
      plan = initialPlan
      val uploadId = newUploadId()
      transport.createSession(credential, uploadId, request)
      checkpoint = ChunkCheckpointEntity(
        uploadId = uploadId,
        jobId = jobId,
        chunkSize = initialPlan.chunkSize,
        confirmedChunks = emptyList(),
        updatedAt = now(),
      )
      checkpoints.save(checkNotNull(checkpoint))
    }

    val activeCheckpoint = checkNotNull(checkpoint)
    val activePlan = checkNotNull(plan)
    val confirmed = activeCheckpoint.confirmedChunks.toMutableSet()
    request.onProgress(
      activePlan.chunks.takeWhile { it.name in confirmed }.sumOf(UploadChunk::byteCount),
    )
    for (chunk in activePlan.chunks) {
      if (chunk.name in confirmed) continue
      if (request.isCancelled()) throw TransferCancelledException()
      transport.uploadChunk(credential, activeCheckpoint.uploadId, request, chunk)
      confirmed += chunk.name
      checkpoints.save(
        activeCheckpoint.copy(confirmedChunks = confirmed.sorted(), updatedAt = now()),
      )
    }
    if (request.isCancelled()) throw TransferCancelledException()
    val result = transport.finalize(credential, activeCheckpoint.uploadId, request)
    checkpoints.delete(jobId)
    return result
  }

  private fun ChunkTransport.abortBestEffort(
    credential: StoredAccountCredential,
    uploadId: String,
    request: DavUploadRequest,
  ) {
    runCatching { abort(credential, uploadId, request) }
  }
}
