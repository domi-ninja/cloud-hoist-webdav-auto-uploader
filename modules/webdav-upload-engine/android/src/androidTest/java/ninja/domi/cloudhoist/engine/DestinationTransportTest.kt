package ninja.domi.cloudhoist.engine

import androidx.test.ext.junit.runners.AndroidJUnit4
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DestinationTransportTest {
  private fun credential(server: MockWebServer) = StoredAccountCredential(StoredAccount("a", server.url("/").toString().trimEnd('/'), "u", "dav", "Test", "2026-10-22T00:00:00Z", AccountCapabilities("34", true, null)), "test")
  @Test fun moveUsesEncodedExactDestinationAndConditionalNonOverwriteHeaders() {
    MockWebServer().use { server ->
      server.enqueue(MockResponse().setResponseCode(201)); server.start()
      NextcloudDestinationClient().relocate(credential(server), listOf("Old", "Grüezi #.jpg"), listOf("New", "Custom", "Grüezi #.jpg"), "\"original\"", false)
      val request = server.takeRequest()
      assertEquals("MOVE", request.method); assertEquals("F", request.getHeader("Overwrite"))
      assertEquals("\"original\"", request.getHeader("If-Match"))
      assertTrue(request.getHeader("Destination")!!.endsWith("/New/Custom/Gr%C3%BCezi%20%23.jpg"))
    }
  }
  @Test fun hashesConditionalContentAndGuardsBothFilesWhenDeletingDuplicate() {
    MockWebServer().use { server ->
      server.enqueue(MockResponse().setBody("abc")); server.enqueue(MockResponse().setResponseCode(204)); server.start()
      val client = NextcloudDestinationClient()
      assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", client.hash(credential(server), listOf("a"), "\"source\""))
      val hash = server.takeRequest()
      assertEquals("GET", hash.method); assertEquals("\"source\"", hash.getHeader("If-Match"))
      client.deleteDuplicate(credential(server), listOf("a"), listOf("b"), "\"source\"", "\"target\"")
      val deletion = server.takeRequest()
      assertEquals("DELETE", deletion.method); assertEquals("\"source\"", deletion.getHeader("If-Match"))
      assertTrue(deletion.getHeader("If")!!.endsWith("/b> ([\"target\"])"))
    }
  }
  @Test fun changedContentCannotBeHashedOrDeletedWithStaleVersions() {
    MockWebServer().use { server ->
      server.enqueue(MockResponse().setResponseCode(412)); server.enqueue(MockResponse().setResponseCode(412)); server.start()
      val client = NextcloudDestinationClient()
      assertThrows(DestinationPreconditionException::class.java) { client.hash(credential(server), listOf("a"), "old") }
      assertThrows(DestinationPreconditionException::class.java) { client.deleteDuplicate(credential(server), listOf("a"), listOf("b"), "old", "target") }
    }
  }
  @Test fun reportsConditionalConflictAndPermissionsInsteadOfPretendingSuccess() {
    MockWebServer().use { server ->
      server.enqueue(MockResponse().setResponseCode(412)); server.enqueue(MockResponse().setResponseCode(403)); server.start()
      val client = NextcloudDestinationClient()
      val error = assertThrows(DestinationPreconditionException::class.java) { client.relocate(credential(server), listOf("a"), listOf("b"), "etag", false) }
      assertTrue(error.message!!.contains("changed"))
      assertThrows(DavPermissionException::class.java) { client.etag(credential(server), listOf("a")) }
    }
  }
}
