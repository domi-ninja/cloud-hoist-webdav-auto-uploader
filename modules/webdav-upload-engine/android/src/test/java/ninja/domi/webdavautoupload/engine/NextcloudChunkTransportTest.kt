package ninja.domi.webdavautoupload.engine

import java.io.ByteArrayInputStream
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.blackholeSink
import okio.buffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NextcloudChunkTransportTest {
  @Test
  fun sendsV2HeadersAndStagesAssemblyBeforeOverwrite() {
    val captured = mutableListOf<Captured>()
    val transport = transport { request ->
      request.body?.writeTo(blackholeSink().buffer())
      captured += capture(request)
      response(
        request,
        when (request.method) {
          "MKCOL" -> if (request.url.encodedPath.contains("/uploads/")) 201 else 405
          "PUT" -> 201
          "MOVE" -> 204
          else -> error("Unexpected ${request.method}")
        },
        if (request.url.encodedPath.endsWith("/.file")) {
          mapOf("X-OC-MTime" to "accepted")
        } else {
          emptyMap()
        },
      )
    }
    val plan = checkNotNull(chunkPlan(UPLOAD.byteCount, true, null))

    transport.createSession(CREDENTIAL, "upload-id", UPLOAD)
    plan.chunks.forEach { transport.uploadChunk(CREDENTIAL, "upload-id", UPLOAD, it) }
    val result = transport.finalize(CREDENTIAL, "upload-id", UPLOAD)

    assertEquals(listOf("00001", "00002"), captured.filter { it.method == "PUT" }.map {
      it.path.substringAfterLast('/')
    })
    assertTrue(captured.filter { it.method == "PUT" }.all {
      it.totalLength == UPLOAD.byteCount.toString() &&
        it.destination?.endsWith(".webdav-auto-upload-upload-id") == true
    })
    val moves = captured.filter { it.method == "MOVE" }
    assertTrue(moves.first().path.endsWith("/upload-id/.file"))
    assertTrue(moves.first().destination.orEmpty().endsWith(".webdav-auto-upload-upload-id"))
    assertTrue(moves.last().destination.orEmpty().endsWith("/large%20file.bin"))
    assertEquals("T", moves.last().overwrite)
    assertTrue(result.modificationTimeAccepted)
  }

  @Test
  fun listsOnlyNumericV2ChunkNamesAndTreatsNotFoundAsExpiry() {
    val xml = """
      <d:multistatus xmlns:d="DAV:">
        <d:response><d:href>/remote.php/dav/uploads/user/id/</d:href></d:response>
        <d:response><d:href>/remote.php/dav/uploads/user/id/00002</d:href></d:response>
        <d:response><d:href>/remote.php/dav/uploads/user/id/notes</d:href></d:response>
      </d:multistatus>
    """.trimIndent()
    var missing = false
    val transport = transport { request ->
      if (missing) response(request, 404) else response(request, 207, body = xml)
    }

    assertEquals(setOf("00002"), transport.listChunks(CREDENTIAL, "id", UPLOAD))
    missing = true
    assertNull(transport.listChunks(CREDENTIAL, "id", UPLOAD))
  }

  @Test
  fun omitsUnknownOrInvalidTimestampsDuringAssembly() {
    val captured = mutableListOf<Captured>()
    val transport = transport { request ->
      captured += capture(request)
      response(request, 204)
    }

    transport.finalize(
      CREDENTIAL,
      "upload-id",
      UPLOAD.copy(modifiedAtEpochSeconds = 0, createdAtEpochSeconds = -1),
    )

    val assembly = captured.first()
    assertNull(assembly.modifiedAt)
    assertNull(assembly.createdAt)
  }

  @Test
  fun abortRemovesBothTheSessionAndAnAssembledStagingFile() {
    val deleted = mutableListOf<String>()
    val transport = transport { request ->
      deleted += request.url.encodedPath
      response(request, 204)
    }

    transport.abort(CREDENTIAL, "id", UPLOAD)

    assertTrue(deleted.first().endsWith("/uploads/user/id/"))
    assertTrue(deleted.last().endsWith("/.large%20file.bin.webdav-auto-upload-id"))
  }

  @Test
  fun abortStillRemovesTheStagingFileWhenSessionDeletionFails() {
    val deleted = mutableListOf<String>()
    val transport = transport { request ->
      deleted += request.url.encodedPath
      response(request, if (deleted.size == 1) 500 else 204)
    }

    val failure = runCatching { transport.abort(CREDENTIAL, "id", UPLOAD) }.exceptionOrNull()

    assertTrue(failure is AccountServerException)
    assertEquals(2, deleted.size)
    assertTrue(deleted.last().endsWith(".webdav-auto-upload-id"))
  }

  private fun transport(respond: (Request) -> Response) = NextcloudChunkTransport(
    contentSource = LocalContentSource { ByteArrayInputStream(ByteArray(UPLOAD.byteCount.toInt())) },
    httpClient = OkHttpClient.Builder().addInterceptor { chain -> respond(chain.request()) }.build(),
  )

  private fun capture(request: Request) = Captured(
    method = request.method,
    path = request.url.encodedPath,
    destination = request.header("Destination"),
    totalLength = request.header("OC-Total-Length"),
    overwrite = request.header("Overwrite"),
    modifiedAt = request.header("X-OC-Mtime"),
    createdAt = request.header("X-OC-CTime"),
  )

  private fun response(
    request: Request,
    code: Int,
    headers: Map<String, String> = emptyMap(),
    body: String = "",
  ) = Response.Builder()
    .request(request)
    .protocol(Protocol.HTTP_1_1)
    .code(code)
    .message("fixture")
    .apply { headers.forEach(::header) }
    .body(body.toResponseBody("application/xml".toMediaType()))
    .build()

  private data class Captured(
    val method: String,
    val path: String,
    val destination: String?,
    val totalLength: String?,
    val overwrite: String?,
    val modifiedAt: String?,
    val createdAt: String?,
  )

  private companion object {
    val CREDENTIAL = StoredAccountCredential(
      StoredAccount(
        id = "account",
        serverUrl = "https://cloud.example.test/nextcloud",
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
      fileName = "large file.bin",
      byteCount = CHUNK_THRESHOLD_BYTES,
      mimeType = "application/octet-stream",
      modifiedAtEpochSeconds = 100,
      createdAtEpochSeconds = 50,
    )
  }
}
