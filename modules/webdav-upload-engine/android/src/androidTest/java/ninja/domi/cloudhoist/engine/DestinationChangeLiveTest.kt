package ninja.domi.cloudhoist.engine

import android.content.Context
import android.util.Base64
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.security.MessageDigest
import java.util.UUID
import okhttp3.Credentials
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Isolated test host and UUID-owned DAV root. Never opens the user's app database or media. */
@RunWith(AndroidJUnit4::class)
class DestinationChangeLiveTest {
  @Test fun realServerMovesMultipleFoldersAndSingleSharedTargetThenUploadsCopies() {
    val encoded = InstrumentationRegistry.getArguments().getString("destinationCredentialsB64")
    assumeTrue("Live destination credentials were not supplied.", !encoded.isNullOrBlank())
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
    fun request(path: List<String>) = Request.Builder()
      .url(NextcloudDavUrl.file(credential.account, path.dropLast(1), path.last()))
      .header("Authorization", Credentials.basic(credential.account.loginName, credential.appPassword, Charsets.UTF_8))
    val root = listOf("CloudHoistDestinationCheck-${UUID.randomUUID()}")
    val owned = http.newCall(request(root).method("MKCOL", null).build()).execute().use { it.code == 201 }
    assertTrue("Could not create the test-owned remote root.", owned)
    val database = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext<Context>(), EngineRoomDatabase::class.java).allowMainThreadQueries().build()
    try {
      val dao = database.engineDao()
      val account = credential.account
      dao.upsertAccount(AccountEntity(account.id, account.serverUrl, account.loginName, account.davUserId, "Test", 1, "34", true, null, "test"))
      val manager = DestinationChangeManager(database, repository)
      manager.root(root + "Before")
      val bytes = ByteArray(262_177) { (it * 17).toByte() }
      val uploader = NextcloudUploadClient(LocalContentSource { bytes.inputStream() })
      fun verify(path: List<String>) {
        http.newCall(request(path).get().build()).execute().use { response ->
          assertTrue("Expected uploaded file was missing.", response.isSuccessful)
          assertArrayEquals(MessageDigest.getInstance("SHA-256").digest(bytes), MessageDigest.getInstance("SHA-256").digest(response.body!!.bytes()))
        }
      }
      for (id in listOf("one", "two")) {
        val path = root + listOf("Before", "Custom-$id")
        dao.upsertSource(SourceEntity(id, account.id, id, "saf", "content://test/$id", path, id == "one", 1, 100, null))
        val revision = LocalRevisionEntity("r-$id", id, id, "content://test/$id", "Grüezi $id #.bin", bytes.size.toLong(), System.currentTimeMillis() / 1000, 100)
        uploader.upload(credential, DavUploadRequest(revision.localUri, path, revision.relativePath, revision.byteCount, "application/octet-stream", revision.modifiedAt, revision.modifiedAt))
        dao.enqueueRevision(revision, UploadJobEntity("j-$id", account.id, id, revision.id, path, revision.relativePath, JobState.COMPLETED, 1, null, 2, null, 0, null, null, null))
        verify(path + revision.relativePath)
      }
      fun change(target: List<String>, source: String? = null, mode: String = "move") {
        val result = manager.begin(DestinationChangeRequest().apply { sourceId = source; pathSegments = target; rootChange = source == null }, mode)
        val operation = manager.run(result["id"] as String)
        assertEquals(operation["message"] as? String, "completed", operation["state"])
        manager.acknowledge(result["id"] as String)
      }
      change(root + "After")
      for (id in listOf("one", "two")) {
        verify(root + listOf("After", "Custom-$id", "Grüezi $id #.bin"))
        assertNull(NextcloudDestinationClient().etag(credential, root + listOf("Before", "Custom-$id", "Grüezi $id #.bin")))
      }
      assertFalse(dao.source("two")!!.enabled)
      change(root + listOf("After", "Custom-two"), "one")
      assertEquals(dao.source("one")!!.remotePathSegments, dao.source("two")!!.remotePathSegments)
      verify(root + listOf("After", "Custom-two", "Grüezi one #.bin"))
      verify(root + listOf("After", "Custom-two", "Grüezi two #.bin"))
      change(root + listOf("After", "Copies"), "one", "copy")
      assertEquals(JobState.QUEUED, dao.job("j-one")!!.state)
      val drain = QueueDrainRunner(dao, repository, uploader, mimeType = { "application/octet-stream" }, isPaused = { false }).run()
      assertEquals(1, drain.completedJobs)
      verify(root + listOf("After", "Copies", "Grüezi one #.bin"))
      verify(root + listOf("After", "Custom-two", "Grüezi one #.bin"))
    } finally {
      database.close()
      if (owned) http.newCall(request(root).delete().build()).execute().use {
        assertTrue("Could not remove the test-owned remote root.", it.code in listOf(204, 404))
      }
    }
  }
}
