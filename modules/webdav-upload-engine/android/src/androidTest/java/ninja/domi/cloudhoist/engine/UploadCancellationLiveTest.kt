package ninja.domi.cloudhoist.engine

import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.Credentials
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Uses only an isolated DAV folder and in-memory bytes, never the live app database. */
@RunWith(AndroidJUnit4::class)
class UploadCancellationLiveTest {
  @Test fun cancelledDirectAndChunkTransfersRemoveRemoteTemporaryObjects() {
    val encoded = InstrumentationRegistry.getArguments().getString("destinationCredentialsB64")
    assumeTrue(!encoded.isNullOrBlank())
    val input = JSONObject(String(Base64.decode(encoded, Base64.URL_SAFE or Base64.NO_WRAP), Charsets.UTF_8))
    var stored: StoredAccountCredential? = null
    val repository = object : AccountRepository {
      override fun currentAccount() = stored?.account
      override fun credential() = stored
      override fun save(credential: StoredAccountCredential) { stored = credential }
      override fun clear() { stored = null }
    }
    AccountManager(repository, NextcloudClient(), onAccountChanged = {}).connectManual(
      input.getString("serverUrl"), input.getString("username"), input.getString("appPassword"))
    val credential = stored!!
    val http = OkHttpClient()
    val id = UUID.randomUUID().toString()
    val root = listOf("CloudHoistCancelTest-$id")
    fun request(url: okhttp3.HttpUrl) = Request.Builder().url(url)
      .header("Authorization", Credentials.basic(credential.account.loginName, credential.appPassword, Charsets.UTF_8))
    val rootUrl = NextcloudDavUrl.folder(credential.account, root)
    assertEquals(201, http.newCall(request(rootUrl).method("MKCOL", null).build()).execute().use { it.code })
    val bytes = ByteArray(24 * 1024 * 1024) { (it % 251).toByte() }
    try {
      for (chunked in listOf(false, true)) {
        val cancelled = AtomicBoolean(false)
        val uploadId = "$id-$chunked"
        val fileName = "cancel-$chunked.bin"
        val upload = DavUploadRequest("memory://test", root, fileName, bytes.size.toLong(),
          "application/octet-stream", null, null, transferId = uploadId,
          isCancelled = cancelled::get, onProgress = { if (it >= 1024 * 1024) cancelled.set(true) })
        val source = LocalContentSource { bytes.inputStream() }
        var checkpoint: ChunkCheckpointEntity? = null
        val store = object : ChunkCheckpointStore {
          override fun load(jobId: String) = checkpoint
          override fun save(value: ChunkCheckpointEntity) { checkpoint = value }
          override fun delete(jobId: String) { checkpoint = null }
        }
        val failure = runCatching {
          if (chunked) {
            assertTrue(credential.account.capabilities.chunkingSupported)
            NextcloudChunkUploadClient(store, NextcloudChunkTransport(source), newUploadId = { uploadId })
              .upload(credential, uploadId, upload)
          } else NextcloudUploadClient(source).upload(credential, upload)
        }.exceptionOrNull()
        assertTrue("Expected cancellation, got ${failure?.javaClass?.simpleName}", failure is TransferCancelledException)
        fun missing(url: okhttp3.HttpUrl) {
          assertEquals("Temporary object remains", 404,
            http.newCall(request(url).method("PROPFIND", null).header("Depth", "0").build()).execute().use { it.code })
        }
        missing(NextcloudDavUrl.file(credential.account, root, fileName))
        missing(NextcloudDavUrl.file(credential.account, root, ".$fileName.cloud-hoist-$uploadId"))
        if (chunked) {
          assertNull(checkpoint)
          missing(NextcloudDavUrl.uploadFolder(credential.account, uploadId))
        }
        // Starting again after cleanup must upload the original bytes, not a partial file.
        val resumed = upload.copy(isCancelled = { false }, onProgress = {})
        if (chunked) NextcloudChunkUploadClient(store, NextcloudChunkTransport(source), newUploadId = { uploadId })
          .upload(credential, uploadId, resumed)
        else NextcloudUploadClient(source).upload(credential, resumed)
        http.newCall(request(NextcloudDavUrl.file(credential.account, root, fileName)).get().build()).execute().use {
          assertTrue(it.isSuccessful)
          assertArrayEquals(java.security.MessageDigest.getInstance("SHA-256").digest(bytes),
            java.security.MessageDigest.getInstance("SHA-256").digest(it.body!!.bytes()))
        }
      }
    } finally {
      http.newCall(request(rootUrl).delete().build()).execute().close()
    }
  }
}
