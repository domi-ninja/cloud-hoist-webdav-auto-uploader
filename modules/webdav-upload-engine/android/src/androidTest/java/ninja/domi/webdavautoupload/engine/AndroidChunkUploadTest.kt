package ninja.domi.webdavautoupload.engine

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidChunkUploadTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()
  private val insertedUris = mutableListOf<Uri>()
  private lateinit var server: MockWebServer

  @Before
  fun startServer() {
    server = MockWebServer()
    server.enqueue(MockResponse().setResponseCode(201))
    server.enqueue(MockResponse().setResponseCode(201))
    server.enqueue(MockResponse().setResponseCode(201))
    server.enqueue(
      MockResponse().setResponseCode(207)
        .setHeader("Content-Type", "application/xml")
        .setBody(
          """
          <d:multistatus xmlns:d="DAV:">
            <d:response><d:href>/remote.php/dav/uploads/fixture-user/upload-id/</d:href></d:response>
            <d:response><d:href>/remote.php/dav/uploads/fixture-user/upload-id/00001</d:href></d:response>
          </d:multistatus>
          """.trimIndent(),
        ),
    )
    server.enqueue(MockResponse().setResponseCode(201))
    server.enqueue(MockResponse().setResponseCode(201))
    server.enqueue(
      MockResponse().setResponseCode(204)
        .setHeader("X-OC-MTime", "accepted")
        .setHeader("X-OC-CTime", "accepted"),
    )
    server.enqueue(MockResponse().setResponseCode(204))
    server.start()
  }

  @After
  fun cleanUp() {
    insertedUris.forEach { context.contentResolver.delete(it, null, null) }
    server.shutdown()
  }

  @Test
  fun resumesARealContentUriAndFinalizesTheExactBytes() {
    val bytes = ByteArray((CHUNK_THRESHOLD_BYTES + 257).toInt()) { index ->
      (index * 31 + index / 251).toByte()
    }
    val localUri = insertFixture("chunk-upload-${System.nanoTime()}.bin", bytes)
    val store = RecordingCheckpointStore()
    val transport = NextcloudChunkTransport(
      AndroidLocalContentSource(context.contentResolver),
    )
    var stopAfterFirstChunk = true
    val interruptedRequest = request(localUri, bytes.size.toLong()) {
      stopAfterFirstChunk && store.current?.confirmedChunks == listOf("00001")
    }

    val interrupted = runCatching {
      client(store, transport).upload(credential(), "job", interruptedRequest)
    }.exceptionOrNull()

    assertTrue(interrupted is TransferCancelledException)
    assertEquals(listOf("00001"), store.current?.confirmedChunks)

    stopAfterFirstChunk = false
    val result = checkNotNull(
      client(store, transport).upload(
        credential(),
        "job",
        request(localUri, bytes.size.toLong()),
      ),
    )

    val requests = List(8) { server.takeRequest() }
    assertEquals(
      listOf("MKCOL", "MKCOL", "PUT", "PROPFIND", "PUT", "PUT", "MOVE", "MOVE"),
      requests.map { it.method },
    )
    val uploaded = ByteArrayOutputStream().apply {
      requests.filter { it.method == "PUT" }.forEach { write(it.body.readByteArray()) }
    }.toByteArray()
    assertArrayEquals(hash(bytes), hash(uploaded))
    assertTrue(requests[6].path.orEmpty().endsWith("/upload-id/.file"))
    assertTrue(requests[6].getHeader("Destination").orEmpty().contains(".part"))
    assertTrue(requests[7].getHeader("Destination").orEmpty().endsWith("/large.bin"))
    assertEquals("T", requests[7].getHeader("Overwrite"))
    assertTrue(result.modificationTimeAccepted)
    assertTrue(result.creationTimeAccepted)
    assertNull(store.current)
  }

  private fun client(store: ChunkCheckpointStore, transport: ChunkTransport) =
    NextcloudChunkUploadClient(
      checkpoints = store,
      transport = transport,
      newUploadId = { "upload-id" },
      now = { 1_000 },
    )

  private fun request(
    localUri: Uri,
    byteCount: Long,
    isCancelled: () -> Boolean = { false },
  ) = DavUploadRequest(
    localUri = localUri.toString(),
    remotePathSegments = listOf("Auto Upload"),
    fileName = "large.bin",
    byteCount = byteCount,
    mimeType = "application/octet-stream",
    modifiedAtEpochSeconds = 1_700_000_000,
    createdAtEpochSeconds = 1_600_000_000,
    isCancelled = isCancelled,
  )

  private fun insertFixture(name: String, bytes: ByteArray): Uri {
    val uri = checkNotNull(
      context.contentResolver.insert(
        MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
        ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, name)
          put(MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream")
          put(MediaStore.MediaColumns.IS_PENDING, 1)
        },
      ),
    )
    insertedUris += uri
    context.contentResolver.openOutputStream(uri)!!.use { it.write(bytes) }
    context.contentResolver.update(
      uri,
      ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) },
      null,
      null,
    )
    return uri
  }

  private fun credential() = StoredAccountCredential(
    StoredAccount(
      id = "fixture-account",
      serverUrl = server.url("/").toString(),
      loginName = "fixture-user",
      davUserId = "fixture-user",
      displayName = "Fixture",
      checkedAt = "2026-09-04T12:00:00Z",
      capabilities = AccountCapabilities("fixture", true, null),
    ),
    "fixture-password",
  )

  private fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes)

  private class RecordingCheckpointStore : ChunkCheckpointStore {
    var current: ChunkCheckpointEntity? = null

    override fun load(jobId: String) = current

    override fun save(checkpoint: ChunkCheckpointEntity) {
      current = checkpoint
    }

    override fun delete(jobId: String) {
      current = null
    }
  }
}
