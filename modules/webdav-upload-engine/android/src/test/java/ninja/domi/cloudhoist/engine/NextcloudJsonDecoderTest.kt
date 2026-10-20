package ninja.domi.cloudhoist.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class NextcloudJsonDecoderTest {
  @Test
  fun decodesLoginFlowStartAndCredentials() {
    val start = NextcloudJsonDecoder.decodeLoginFlowStart(
      """{
        "poll":{"token":"opaque-token","endpoint":"https://cloud.test/login/v2/poll"},
        "login":"https://cloud.test/login/v2/flow/opaque"
      }""",
    )
    assertEquals("https://cloud.test/login/v2/poll", start.pollEndpoint)
    assertEquals("opaque-token", start.token)

    val credentials = NextcloudJsonDecoder.decodeLoginFlowCredentials(
      """{
        "server":"https://authoritative.cloud.test/base",
        "loginName":"domi@example.test",
        "appPassword":"secret-app-password"
      }""",
    )
    assertEquals("https://authoritative.cloud.test/base", credentials.serverUrl)
    assertEquals("domi@example.test", credentials.loginName)
  }

  @Test
  fun resolvesDavUserIdAndCapabilityFields() {
    val user = NextcloudJsonDecoder.decodeUser(
      ocs("""{"id":"dav-id","displayname":"Domi"}"""),
    )
    val capabilities = NextcloudJsonDecoder.decodeCapabilities(
      ocs(
        """{
          "version":{"string":"34.0.0"},
          "capabilities":{"files":{"bigfilechunking":true,"max_chunk_size":10485760}}
        }""",
      ),
    )

    assertEquals("dav-id", user.id)
    assertTrue(capabilities.chunkingSupported)
    assertEquals(10485760L, capabilities.maxChunkSize)
  }

  @Test
  fun missingFileCapabilitiesUseSafeFallbacks() {
    val capabilities = NextcloudJsonDecoder.decodeCapabilities(
      ocs("""{"version":{"string":"28.0.0"},"capabilities":{}}"""),
    )
    assertFalse(capabilities.chunkingSupported)
    assertEquals(null, capabilities.maxChunkSize)
  }

  @Test
  fun rejectsMalformedAndUnauthorizedOcsResponses() {
    assertThrows(AccountUnsupportedResponseException::class.java) {
      NextcloudJsonDecoder.decodeUser("<html>maintenance</html>")
    }
    assertThrows(AccountInvalidCredentialsException::class.java) {
      NextcloudJsonDecoder.decodeUser(
        """{"ocs":{"meta":{"status":"failure","statuscode":997},"data":{}}}""",
      )
    }
  }

  private fun ocs(data: String) =
    """{"ocs":{"meta":{"status":"ok","statuscode":200},"data":$data}}"""
}
