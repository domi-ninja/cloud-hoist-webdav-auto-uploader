package ninja.domi.cloudhoist.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NextcloudChunkUploadClientTest {
  @Test
  fun reconcilesLocalAndRemoteChunksBeforeResuming() {
    val store = FakeCheckpointStore(checkpoint("saved-id", listOf("00001")))
    val transport = FakeChunkTransport(remoteChunks = setOf("00002"))
    val client = client(store, transport)

    val result = client.upload(CREDENTIAL, JOB_ID, UPLOAD)

    assertEquals(listOf("00001", "00003"), transport.uploadedChunks)
    assertEquals("saved-id", transport.finalizedUploadId)
    assertEquals(listOf("00002"), store.saved.first().confirmedChunks)
    assertNull(store.current)
    assertEquals(DavUploadResult(true, false), result)
  }

  @Test
  fun replacesAnExpiredSessionAndUploadsEveryChunk() {
    val store = FakeCheckpointStore(checkpoint("expired-id", listOf("00001")))
    val transport = FakeChunkTransport(remoteChunks = null)
    val client = client(store, transport, newUploadId = { "replacement-id" })

    client.upload(CREDENTIAL, JOB_ID, UPLOAD)

    assertEquals(listOf("replacement-id"), transport.createdUploadIds)
    assertEquals(listOf("00001", "00002", "00003"), transport.uploadedChunks)
    assertEquals("replacement-id", transport.finalizedUploadId)
    assertNull(store.current)
  }

  @Test
  fun retainsCheckpointAfterTransientFailure() {
    val store = FakeCheckpointStore()
    val transport = FakeChunkTransport(failChunk = "00002", failure = AccountTimeoutException())
    val client = client(store, transport)

    val failure = runCatching { client.upload(CREDENTIAL, JOB_ID, UPLOAD) }.exceptionOrNull()

    assertTrue(failure is AccountTimeoutException)
    assertEquals(listOf("00001"), store.current?.confirmedChunks)
    assertTrue(transport.abortedUploadIds.isEmpty())
  }

  @Test
  fun abortsAndDropsCheckpointAfterPermanentFailure() {
    val store = FakeCheckpointStore()
    val transport = FakeChunkTransport(failChunk = "00002", failure = DavQuotaException())
    val client = client(store, transport)

    val failure = runCatching { client.upload(CREDENTIAL, JOB_ID, UPLOAD) }.exceptionOrNull()

    assertTrue(failure is DavQuotaException)
    assertEquals(listOf("new-id"), transport.abortedUploadIds)
    assertNull(store.current)
  }

  @Test
  fun returnsNullWithoutCreatingStateWhenChunkingDoesNotApply() {
    val store = FakeCheckpointStore(checkpoint("stale-id", emptyList()))
    val transport = FakeChunkTransport()
    val client = client(store, transport)
    val small = UPLOAD.copy(byteCount = CHUNK_THRESHOLD_BYTES - 1)

    assertNull(client.upload(CREDENTIAL, JOB_ID, small))
    assertTrue(store.saved.isEmpty())
    assertTrue(transport.createdUploadIds.isEmpty())
    assertEquals(listOf("stale-id"), transport.abortedUploadIds)
    assertNull(store.current)
  }

  @Test
  fun cancellationAbortsTheSessionAndDropsItsCheckpoint() {
    val store = FakeCheckpointStore()
    val transport = FakeChunkTransport(failChunk = "00002", failure = TransferCancelledException())
    val failure = runCatching { client(store, transport).upload(CREDENTIAL, JOB_ID, UPLOAD) }.exceptionOrNull()
    assertTrue(failure is TransferCancelledException)
    assertEquals(listOf("new-id"), transport.abortedUploadIds)
    assertNull(store.current)
    assertNull(transport.finalizedUploadId)
  }

  @Test
  fun failedCancellationCleanupRetainsCheckpointForRetry() {
    val store = FakeCheckpointStore()
    val transport = FakeChunkTransport(failChunk = "00002", failure = TransferCancelledException(), failAbort = true)
    val failure = runCatching { client(store, transport).upload(CREDENTIAL, JOB_ID, UPLOAD) }.exceptionOrNull()
    assertTrue(failure is TransferCancelledException)
    assertEquals("new-id", store.current?.uploadId)
    assertNull(transport.finalizedUploadId)
  }

  private fun client(
    store: FakeCheckpointStore,
    transport: FakeChunkTransport,
    newUploadId: () -> String = { "new-id" },
  ) = NextcloudChunkUploadClient(
    checkpoints = store,
    transport = transport,
    newUploadId = newUploadId,
    now = generateSequence(100L) { it + 1 }.iterator()::next,
  )

  private fun checkpoint(uploadId: String, confirmed: List<String>) = ChunkCheckpointEntity(
    uploadId = uploadId,
    jobId = JOB_ID,
    chunkSize = DEFAULT_CHUNK_BYTES,
    confirmedChunks = confirmed,
    updatedAt = 1,
  )

  private class FakeCheckpointStore(
    initial: ChunkCheckpointEntity? = null,
  ) : ChunkCheckpointStore {
    var current = initial
    val saved = mutableListOf<ChunkCheckpointEntity>()

    override fun load(jobId: String) = current

    override fun save(checkpoint: ChunkCheckpointEntity) {
      current = checkpoint
      saved += checkpoint
    }

    override fun delete(jobId: String) {
      current = null
    }
  }

  private class FakeChunkTransport(
    private val remoteChunks: Set<String>? = emptySet(),
    private val failChunk: String? = null,
    private val failure: Exception = AccountTimeoutException(),
    private val failAbort: Boolean = false,
  ) : ChunkTransport {
    val createdUploadIds = mutableListOf<String>()
    val uploadedChunks = mutableListOf<String>()
    val abortedUploadIds = mutableListOf<String>()
    var finalizedUploadId: String? = null

    override fun createSession(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
    ) {
      createdUploadIds += uploadId
    }

    override fun listChunks(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
    ) = remoteChunks

    override fun uploadChunk(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
      chunk: UploadChunk,
    ) {
      if (chunk.name == failChunk) throw failure
      uploadedChunks += chunk.name
    }

    override fun finalize(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
    ): DavUploadResult {
      finalizedUploadId = uploadId
      return DavUploadResult(true, false)
    }

    override fun abort(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
    ) {
      abortedUploadIds += uploadId
      if (failAbort) throw AccountNetworkException()
    }
  }

  private companion object {
    const val JOB_ID = "job"
    val CREDENTIAL = StoredAccountCredential(
      StoredAccount(
        id = "account",
        serverUrl = "https://cloud.example.test",
        loginName = "user",
        davUserId = "user",
        displayName = "User",
        checkedAt = "2026-09-04T12:00:00Z",
        capabilities = AccountCapabilities("34", true, null),
      ),
      "secret",
    )
    val UPLOAD = DavUploadRequest(
      localUri = "content://fixture/large",
      remotePathSegments = listOf("Auto Upload"),
      fileName = "large.bin",
      byteCount = DEFAULT_CHUNK_BYTES * 2 + MIN_CHUNK_BYTES,
      mimeType = "application/octet-stream",
      modifiedAtEpochSeconds = 100,
      createdAtEpochSeconds = 50,
    )
  }
}
