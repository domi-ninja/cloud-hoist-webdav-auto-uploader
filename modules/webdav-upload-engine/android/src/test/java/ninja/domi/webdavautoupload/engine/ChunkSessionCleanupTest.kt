package ninja.domi.webdavautoupload.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChunkSessionCleanupTest {
  @Test
  fun abortsEveryKnownSessionEvenWhenOneCleanupFails() {
    val transport = RecordingTransport(failUploadId = "first")
    val cleanup = ChunkSessionCleanup(
      sessions = {
        listOf(session("first", "one.bin"), session("second", "two.bin"))
      },
      credential = { CREDENTIAL },
      transport = transport,
    )

    cleanup.run()

    assertEquals(listOf("first", "second"), transport.aborted.map { it.first })
    assertEquals("two.bin", transport.aborted.last().second.fileName)
  }

  @Test
  fun doesNothingAfterTheCredentialIsGone() {
    val transport = RecordingTransport()
    val cleanup = ChunkSessionCleanup(
      sessions = { listOf(session("upload", "file.bin")) },
      credential = { null },
      transport = transport,
    )

    cleanup.run()

    assertTrue(transport.aborted.isEmpty())
  }

  private fun session(uploadId: String, fileName: String) = ChunkSessionRecord(
    uploadId = uploadId,
    localUri = "content://fixture/$uploadId",
    remotePathSegments = listOf("Auto Upload"),
    remoteFileName = fileName,
    byteCount = 10,
    mimeType = "application/octet-stream",
    modifiedAt = 20,
    createdAt = 15,
  )

  private class RecordingTransport(
    private val failUploadId: String? = null,
  ) : ChunkTransport {
    val aborted = mutableListOf<Pair<String, DavUploadRequest>>()

    override fun createSession(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
    ) = Unit

    override fun listChunks(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
    ): Set<String>? = emptySet()

    override fun uploadChunk(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
      chunk: UploadChunk,
    ) = Unit

    override fun finalize(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
    ) = DavUploadResult(false, false)

    override fun abort(
      credential: StoredAccountCredential,
      uploadId: String,
      request: DavUploadRequest,
    ) {
      aborted += uploadId to request
      if (uploadId == failUploadId) throw AccountTimeoutException()
    }
  }

  private companion object {
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
      appPassword = "secret",
    )
  }
}
