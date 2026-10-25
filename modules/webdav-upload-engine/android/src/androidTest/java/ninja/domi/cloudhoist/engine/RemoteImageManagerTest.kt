package ninja.domi.cloudhoist.engine

import android.content.Context
import android.net.Uri
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.File
import java.io.IOException
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RemoteImageManagerTest {
  private lateinit var database: EngineRoomDatabase
  private lateinit var cache: File
  private lateinit var server: MockWebServer
  private lateinit var manager: RemoteImageManager

  @Before
  fun setUp() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    database = Room.inMemoryDatabaseBuilder(context, EngineRoomDatabase::class.java).allowMainThreadQueries().build()
    cache = File(context.cacheDir, "image-test-${java.util.UUID.randomUUID()}")
    server = MockWebServer()
    server.start()
    val account = StoredAccount("image-test", server.url("/").toString().trimEnd('/'), "user", "dav", "Test",
      "2026-10-25T00:00:00Z", AccountCapabilities("34", true, null))
    val repository = object : AccountRepository {
      override fun currentAccount() = account
      override fun credential() = StoredAccountCredential(account, "test-password")
      override fun save(credential: StoredAccountCredential) = Unit
      override fun clear() = Unit
    }
    database.engineDao().upsertAccount(AccountEntity(account.id, account.serverUrl, "user", "dav", "Test", 1, "34", true, null, "test"))
    database.engineDao().upsertSource(SourceEntity("source", account.id, "Images", "media_store", "mediastore://camera",
      listOf("Pictures", "Grüezi # %"), true, 1, null, null))
    manager = RemoteImageManager(cache, database.engineDao(), repository, maxImageBytes = 16)
  }

  @After
  fun tearDown() {
    server.shutdown()
    database.close()
    cache.deleteRecursively()
  }

  @Test
  fun downloadsOriginalBytesEncodesPathsAndReusesCache() {
    server.enqueue(MockResponse().setBody("original-image"))
    val uri = manager.image("source", "Nested/Photo # %.jpg", "one")
    assertEquals("original-image", File(Uri.parse(uri).path!!).readText())
    val request = server.takeRequest()
    assertEquals("GET", request.method)
    assertEquals("/remote.php/dav/files/dav/Pictures/Gr%C3%BCezi%20%23%20%25/Nested/Photo%20%23%20%25.jpg", request.path)
    assertNotNull(request.getHeader("Authorization"))
    assertEquals(uri, manager.image("source", "Nested/Photo # %.jpg", "one"))
    assertEquals(1, server.requestCount)
    server.enqueue(MockResponse().setBody("changed-image"))
    val changed = manager.image("source", "Nested/Photo # %.jpg", "two")
    assertNotEquals(uri, changed)
    assertEquals("changed-image", File(Uri.parse(changed).path!!).readText())
  }

  @Test
  fun rejectsDeclaredAndChunkedOversizedImagesWithoutLeavingPartialFiles() {
    server.enqueue(MockResponse().setBody("x".repeat(17)))
    assertThrows(IOException::class.java) { manager.image("source", "large.jpg", null) }
    server.enqueue(MockResponse().setChunkedBody("x".repeat(17), 4))
    assertThrows(IOException::class.java) { manager.image("source", "chunked.jpg", null) }
    assertTrue(cache.listFiles().orEmpty().isEmpty())
  }

  @Test
  fun failedAndEmptyResponsesRemainRetryable() {
    server.enqueue(MockResponse().setResponseCode(404))
    assertThrows(IOException::class.java) { manager.image("source", "gone.jpg", null) }
    server.enqueue(MockResponse().setBody(""))
    assertThrows(IOException::class.java) { manager.image("source", "gone.jpg", null) }
    server.enqueue(MockResponse().setBody("back-again"))
    assertEquals("back-again", File(Uri.parse(manager.image("source", "gone.jpg", null)).path!!).readText())
    assertEquals(1, cache.listFiles()!!.size)
  }

  @Test
  fun refusesTraversalAndMissingBackupsBeforeNetworkAccess() {
    for (path in listOf("../secret.jpg", "/absolute.jpg", "Nested//file.jpg", "./file.jpg")) {
      assertThrows(IllegalArgumentException::class.java) { manager.image("source", path, null) }
    }
    assertThrows(EngineSourceNotFoundException::class.java) { manager.image("missing", "file.jpg", null) }
    assertEquals(0, server.requestCount)
  }
}
