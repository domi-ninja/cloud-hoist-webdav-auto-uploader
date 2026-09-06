package ninja.domi.webdavautoupload.engine

import java.io.ByteArrayInputStream
import java.io.InputStream
import java.time.Instant
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class NextcloudUploadClientTest {
  @Test
  fun streamsToATemporarySiblingThenMovesOverTheDestination() {
    val requests = mutableListOf<CapturedRequest>()
    val client = client { request ->
      requests += capture(request)
      when (request.method) {
        "MKCOL" -> response(request, 405)
        "PUT" -> response(
          request,
          201,
          headers = mapOf("X-OC-MTime" to "accepted", "X-OC-CTime" to "accepted"),
        )
        "MOVE" -> response(request, 204)
        else -> error("Unexpected ${request.method}")
      }
    }

    val result = client.upload(CREDENTIAL, UPLOAD)

    assertEquals(listOf("MKCOL", "PUT", "MOVE"), requests.map { it.method })
    assertEquals("binary fixture", requests.single { it.method == "PUT" }.body)
    val put = requests.single { it.method == "PUT" }
    assertTrue(put.path.endsWith("/.photo%20%231.jpg.webdav-auto-upload-fixed-id"))
    assertFalse(put.path.endsWith(".part"))
    assertFalse(put.path.endsWith("/photo%20%231.jpg"))
    val move = requests.single { it.method == "MOVE" }
    assertTrue(move.destination.orEmpty().endsWith("/photo%20%231.jpg"))
    assertEquals("T", move.overwrite)
    assertEquals("1700000000", put.modifiedAt)
    assertEquals("1600000000", put.createdAt)
    assertTrue(result.modificationTimeAccepted)
    assertTrue(result.creationTimeAccepted)
    assertEquals("photo #1.jpg", result.remoteFileName)
  }

  @Test
  fun keepBothUsesTheFirstAvailableNumericSuffix() {
    val moves = mutableListOf<CapturedRequest>()
    val client = client { request ->
      when (request.method) {
        "MKCOL" -> response(request, 405)
        "PUT" -> response(request, 201)
        "MOVE" -> {
          moves += capture(request)
          response(request, if (moves.size < 3) 412 else 201)
        }
        else -> error("Unexpected ${request.method}")
      }
    }

    val result = client.upload(
      CREDENTIAL,
      UPLOAD.copy(collisionPolicy = CollisionPolicy.KEEP_BOTH),
    )

    assertEquals(listOf("F", "F", "F"), moves.map(CapturedRequest::overwrite))
    assertTrue(moves[0].destination.orEmpty().endsWith("/photo%20%231.jpg"))
    assertTrue(moves[1].destination.orEmpty().endsWith("/photo%20%231.001.jpg"))
    assertTrue(moves[2].destination.orEmpty().endsWith("/photo%20%231.002.jpg"))
    assertEquals("photo #1.002.jpg", result.remoteFileName)
  }

  @Test
  fun supportsAnEmptyFileWithoutBufferingItInReactNative() {
    val client = NextcloudUploadClient(
      contentSource = LocalContentSource { ByteArrayInputStream(ByteArray(0)) },
      httpClient = OkHttpClient.Builder().addInterceptor { chain ->
        response(chain.request(), if (chain.request().method == "MOVE") 201 else 201)
      }.build(),
      uploadId = { "empty" },
    )
    val result = client.upload(
      CREDENTIAL,
      UPLOAD.copy(byteCount = 0, fileName = "empty", modifiedAtEpochSeconds = null),
    )
    assertFalse(result.modificationTimeAccepted)
  }

  @Test
  fun omitsUnknownOrInvalidTimestamps() {
    var put: CapturedRequest? = null
    val client = client { request ->
      capture(request).also { captured ->
        if (request.method == "PUT") put = captured
      }
      response(request, if (request.method == "MKCOL") 405 else 201)
    }

    client.upload(
      CREDENTIAL,
      UPLOAD.copy(modifiedAtEpochSeconds = 0, createdAtEpochSeconds = -1),
    )

    assertNull(put?.modifiedAt)
    assertNull(put?.createdAt)
  }

  @Test
  fun definiteFailureAttemptsTemporaryCleanupButNeverPutsTheFinalPath() {
    val methods = mutableListOf<String>()
    val paths = mutableListOf<String>()
    val client = client { request ->
      methods += request.method
      paths += request.url.encodedPath
      when (request.method) {
        "MKCOL" -> response(request, 405)
        "PUT" -> response(request, 507)
        "DELETE" -> response(request, 204)
        else -> error("The final MOVE must not run")
      }
    }

    assertThrows(DavQuotaException::class.java) { client.upload(CREDENTIAL, UPLOAD) }
    assertEquals(listOf("MKCOL", "PUT", "DELETE"), methods)
    assertTrue(paths.filterIndexed { index, _ -> methods[index] == "PUT" }.none {
      it.endsWith("/photo%20%231.jpg")
    })
  }

  @Test
  fun missingLocalContentHasADistinctFailure() {
    val client = NextcloudUploadClient(
      contentSource = LocalContentSource { null },
      httpClient = OkHttpClient.Builder().addInterceptor { chain ->
        if (chain.request().method == "MKCOL") response(chain.request(), 405)
        else {
          chain.request().body?.writeTo(Buffer())
          response(chain.request(), 201)
        }
      }.build(),
      uploadId = { "missing" },
    )

    assertThrows(LocalContentMissingException::class.java) {
      client.upload(CREDENTIAL, UPLOAD)
    }
  }

  @Test
  fun rateLimitCarriesServerRetryDelay() {
    val client = client { request ->
      when (request.method) {
        "MKCOL" -> response(request, 405)
        "PUT" -> response(request, 429, mapOf("Retry-After" to "120"))
        else -> error("Unexpected ${request.method}")
      }
    }

    val error = assertThrows(DavRateLimitedException::class.java) {
      client.upload(CREDENTIAL, UPLOAD)
    }

    assertEquals(120_000L, error.retryAfterMillis)
  }

  @Test
  fun parsesHttpDateRetryAfterAndRejectsGarbage() {
    val now = Instant.parse("2026-09-04T12:00:00Z")

    assertEquals(60_000L, retryAfterMillis("Fri, 4 Sep 2026 12:01:00 GMT", now))
    assertEquals(null, retryAfterMillis("later-ish", now))
  }

  @Test
  fun retryDelayGrowsWithJitterAndHonorsServerMinimum() {
    assertEquals(30_000L, retryDelayMillis(1, jitter = 0.0))
    assertEquals(60_000L, retryDelayMillis(2, jitter = 0.5))
    assertEquals(180_000L, retryDelayMillis(2, jitter = 0.5, serverDelayMillis = 180_000))
    assertEquals(21_600_000L, retryDelayMillis(99, jitter = 1.0))
  }

  @Test
  fun cancellationDuringStreamingNeverMovesTheTemporaryFile() {
    var cancelled = false
    val methods = mutableListOf<String>()
    val client = NextcloudUploadClient(
      contentSource = LocalContentSource {
        object : InputStream() {
          private var offset = 0

          override fun read(): Int = if (offset < CONTENT.size) {
            CONTENT[offset++].toInt().and(0xff).also { cancelled = true }
          } else {
            -1
          }

          override fun read(target: ByteArray, targetOffset: Int, length: Int): Int {
            if (offset >= CONTENT.size) return -1
            target[targetOffset] = CONTENT[offset++]
            cancelled = true
            return 1
          }
        }
      },
      httpClient = OkHttpClient.Builder().addInterceptor { chain ->
        methods += chain.request().method
        if (chain.request().method == "PUT") {
          chain.request().body!!.writeTo(Buffer())
        }
        response(chain.request(), 201)
      }.build(),
      uploadId = { "cancelled" },
    )

    assertThrows(TransferCancelledException::class.java) {
      client.upload(CREDENTIAL, UPLOAD.copy(isCancelled = { cancelled }))
    }
    assertEquals(listOf("MKCOL", "PUT"), methods)
  }

  private fun client(respond: (Request) -> Response) = NextcloudUploadClient(
    contentSource = LocalContentSource { ByteArrayInputStream(CONTENT) },
    httpClient = OkHttpClient.Builder().addInterceptor { chain -> respond(chain.request()) }.build(),
    uploadId = { "fixed-id" },
  )

  private fun capture(request: Request): CapturedRequest {
    val buffer = Buffer()
    request.body?.writeTo(buffer)
    return CapturedRequest(
      method = request.method,
      path = request.url.encodedPath,
      body = buffer.readUtf8(),
      destination = request.header("Destination"),
      overwrite = request.header("Overwrite"),
      modifiedAt = request.header("X-OC-Mtime"),
      createdAt = request.header("X-OC-CTime"),
    )
  }

  private fun response(
    request: Request,
    code: Int,
    headers: Map<String, String> = emptyMap(),
  ): Response = Response.Builder()
    .request(request)
    .protocol(Protocol.HTTP_1_1)
    .code(code)
    .message("fixture")
    .apply { headers.forEach(::header) }
    .body(ByteArray(0).toResponseBody("text/plain".toMediaType()))
    .build()

  private data class CapturedRequest(
    val method: String,
    val path: String,
    val body: String,
    val destination: String?,
    val overwrite: String?,
    val modifiedAt: String?,
    val createdAt: String?,
  )

  private companion object {
    val CONTENT = "binary fixture".toByteArray()
    val CREDENTIAL = StoredAccountCredential(
      StoredAccount(
        id = "account-1",
        serverUrl = "https://cloud.example.test/nextcloud",
        loginName = "login",
        davUserId = "dav/user",
        displayName = "Domi",
        checkedAt = "2026-09-04T12:00:00Z",
        capabilities = AccountCapabilities("34.0.0", true, null),
      ),
      "secret",
    )
    val UPLOAD = DavUploadRequest(
      localUri = "content://fixture/photo",
      remotePathSegments = listOf("Auto Upload"),
      fileName = "photo #1.jpg",
      byteCount = CONTENT.size.toLong(),
      mimeType = "image/jpeg",
      modifiedAtEpochSeconds = 1_700_000_000,
      createdAtEpochSeconds = 1_600_000_000,
    )
  }
}
