package ninja.domi.webdavautoupload.engine

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.security.MessageDigest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidDirectUploadTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()
  private val insertedUris = mutableListOf<Uri>()
  private lateinit var server: MockWebServer

  @Before
  fun startServer() {
    server = MockWebServer()
    server.apply {
      enqueue(MockResponse().setResponseCode(201))
      enqueue(MockResponse().setResponseCode(405))
      enqueue(
        MockResponse().setResponseCode(201)
          .setHeader("X-OC-MTime", "accepted")
          .setHeader("X-OC-CTime", "accepted"),
      )
      enqueue(MockResponse().setResponseCode(204))
      start()
    }
  }

  @After
  fun cleanUp() {
    insertedUris.forEach { context.contentResolver.delete(it, null, null) }
    server.shutdown()
  }

  @Test
  fun streamsAnAndroidContentUriToAHiddenSiblingBeforeOverwrite() {
    val bytes = ByteArray(131_113) { index -> (index * 31).toByte() }
    val localUri = insertFixture("direct-upload-${System.nanoTime()}.bin", bytes)
    val client = NextcloudUploadClient(AndroidLocalContentSource(context.contentResolver))

    val result = client.upload(
      credential(),
      DavUploadRequest(
        localUri = localUri.toString(),
        remotePathSegments = listOf("Auto Upload", "nested #"),
        fileName = "Grüezi space #.bin",
        byteCount = bytes.size.toLong(),
        mimeType = "application/octet-stream",
        modifiedAtEpochSeconds = 1_700_000_000,
        createdAtEpochSeconds = 1_600_000_000,
      ),
    )

    val firstFolder = server.takeRequest()
    val secondFolder = server.takeRequest()
    val put = server.takeRequest()
    val move = server.takeRequest()
    assertEquals(listOf("MKCOL", "MKCOL", "PUT", "MOVE"), listOf(
      firstFolder.method,
      secondFolder.method,
      put.method,
      move.method,
    ))
    assertTrue(put.path.orEmpty().contains("nested%20%23/.Gr%C3%BCezi%20space%20%23.bin"))
    assertArrayEquals(hash(bytes), hash(put.body.readByteArray()))
    assertTrue(move.getHeader("Destination").orEmpty().endsWith(
      "/nested%20%23/Gr%C3%BCezi%20space%20%23.bin",
    ))
    assertEquals("T", move.getHeader("Overwrite"))
    assertTrue(result.modificationTimeAccepted)
    assertTrue(result.creationTimeAccepted)
  }

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
      capabilities = AccountCapabilities("fixture", false, null),
    ),
    "fixture-password",
  )

  private fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes)
}
