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
  @Test fun reportsConditionalConflictAndPermissionsInsteadOfPretendingSuccess() {
    MockWebServer().use { server ->
      server.enqueue(MockResponse().setResponseCode(412)); server.enqueue(MockResponse().setResponseCode(403)); server.start()
      val client = NextcloudDestinationClient()
      val error = assertThrows(EngineInvalidInputException::class.java) { client.relocate(credential(server), listOf("a"), listOf("b"), "etag", false) }
      assertTrue(error.message!!.contains("No existing file was overwritten"))
      assertThrows(DavPermissionException::class.java) { client.etag(credential(server), listOf("a")) }
    }
  }
}
