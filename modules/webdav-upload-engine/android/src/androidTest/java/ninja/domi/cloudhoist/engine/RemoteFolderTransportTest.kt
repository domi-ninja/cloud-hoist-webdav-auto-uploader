package ninja.domi.cloudhoist.engine

import androidx.test.ext.junit.runners.AndroidJUnit4
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RemoteFolderTransportTest {
  @Test
  fun repairsMissingPathsIncludingAlreadyExistingParentsAndConcurrentCreation() {
    MockWebServer().use { server ->
      server.enqueue(MockResponse().setResponseCode(404))
      server.enqueue(MockResponse().setResponseCode(405))
      server.enqueue(MockResponse().setResponseCode(201))
      // Another client created the final folder before our MKCOL arrived.
      server.enqueue(MockResponse().setResponseCode(405))
      server.enqueue(MockResponse().setResponseCode(207).setBody("""
        <d:multistatus xmlns:d="DAV:">
          <d:response><d:href>/remote.php/dav/files/dav/Parent/New/Gr%C3%BCezi%20%23%20%25/</d:href>
            <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
          </d:response>
          <d:response><d:href>/remote.php/dav/files/dav/Parent/New/Gr%C3%BCezi%20%23%20%25/Child/</d:href>
            <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
          </d:response>
        </d:multistatus>
      """.trimIndent()))
      server.start()
      val path = listOf("Parent", "New", "Grüezi # %")
      assertEquals(listOf(RemoteFolder("Child", path + "Child")), manager(server).list(path))
      val requests = List(5) { server.takeRequest() }
      assertEquals(listOf("PROPFIND", "MKCOL", "MKCOL", "MKCOL", "PROPFIND"), requests.map { it.method })
      val base = "/remote.php/dav/files/dav/"
      val finalPath = "${base}Parent/New/Gr%C3%BCezi%20%23%20%25/"
      assertEquals(listOf(finalPath, "${base}Parent/", "${base}Parent/New/", finalPath, finalPath), requests.map { it.path })
      assertEquals("1", requests.first().getHeader("Depth"))
      assertEquals("1", requests.last().getHeader("Depth"))
    }
  }

  @Test
  fun forbiddenListingsNeverAttemptCreation() {
    MockWebServer().use { server ->
      server.enqueue(MockResponse().setResponseCode(403))
      server.start()
      assertThrows(DavPermissionException::class.java) { manager(server).list(listOf("Private")) }
      assertEquals(1, server.requestCount)
      assertEquals("PROPFIND", server.takeRequest().method)
    }
  }

  @Test
  fun creationErrorsStopRecoveryWithoutClaimingSuccess() {
    MockWebServer().use { server ->
      server.enqueue(MockResponse().setResponseCode(404))
      server.enqueue(MockResponse().setResponseCode(507))
      server.start()
      assertThrows(DavQuotaException::class.java) { manager(server).list(listOf("New", "Child")) }
      assertEquals(2, server.requestCount)
      assertEquals("PROPFIND", server.takeRequest().method)
      assertEquals("MKCOL", server.takeRequest().method)
    }
  }

  private fun manager(server: MockWebServer): RemoteFolderManager {
    val stored = StoredAccountCredential(
      StoredAccount("test", server.url("/").toString().trimEnd('/'), "user", "dav", "Test",
        "2026-10-25T00:00:00Z", AccountCapabilities("34", true, null)),
      "test-password",
    )
    val repository = object : AccountRepository {
      override fun currentAccount() = stored.account
      override fun credential() = stored
      override fun save(credential: StoredAccountCredential) = Unit
      override fun clear() = Unit
    }
    return RemoteFolderManager(repository, NextcloudDavClient())
  }
}
