package ninja.domi.cloudhoist.engine

import java.time.Instant
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import org.junit.Assert.*
import org.junit.Test

class PhoneUploadReadmeTest {
  @Test fun createsWithoutReplacingAnExistingTimestampThenUpdatesAfterSync() {
    val bodies = mutableListOf<String>()
    val conditions = mutableListOf<String?>()
    val http = OkHttpClient.Builder().addInterceptor { chain ->
      val request = chain.request()
      assertEquals("PUT", request.method)
      assertEquals("/remote.php/dav/files/user/Phone%20Uploads/Read%20me%20-%20Cloud%20Hoist.txt", request.url.encodedPath)
      bodies += Buffer().also { request.body!!.writeTo(it) }.readUtf8()
      conditions += request.header("If-None-Match")
      Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(if (bodies.size == 1) 412 else 204)
        .message("fixture").body("".toResponseBody()).build()
    }.build()
    val account = StoredAccount("account", "https://cloud.example.test", "user", "user", "User", "now", AccountCapabilities("34", true, null))
    val credential = StoredAccountCredential(account, "fixture-password")
    val client = PhoneUploadReadme(http)
    client.write(credential, null, onlyIfMissing = true)
    client.write(credential, Instant.parse("2026-10-21T13:00:00Z"))
    assertEquals(listOf("*", null), conditions)
    assertTrue(bodies.first().contains("No uploads completed yet"))
    assertTrue(bodies.last().contains("Last completed upload (UTC): 2026-10-21T13:00:00Z"))
    assertFalse(bodies.last().contains(credential.appPassword))
  }
}
