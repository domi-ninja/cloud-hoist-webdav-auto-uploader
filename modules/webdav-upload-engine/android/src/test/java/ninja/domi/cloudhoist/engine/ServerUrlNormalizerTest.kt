package ninja.domi.cloudhoist.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ServerUrlNormalizerTest {
  @Test
  fun normalizesHostAndTrailingSlashesWithoutGuessingSubpaths() {
    assertEquals(
      "https://cloud.example.test/nextcloud",
      ServerUrlNormalizer.normalize("  HTTPS://Cloud.Example.Test/nextcloud///  "),
    )
  }

  @Test
  fun completesDomainsPortsAndSubpathsWithHttps() {
    assertEquals("https://cloud.example.test", ServerUrlNormalizer.normalize(" cloud.example.test "))
    assertEquals("https://cloud.example.test:8443/nextcloud", ServerUrlNormalizer.normalize("cloud.example.test:8443/nextcloud/"))
    assertEquals("https://cloud.example.test", ServerUrlNormalizer.normalize("//cloud.example.test"))
  }

  @Test
  fun rejectsInsecureAndAmbiguousServerUrls() {
    assertThrows(AccountInsecureServerUrlException::class.java) {
      ServerUrlNormalizer.normalize("http://cloud.example.test")
    }
    assertThrows(AccountInvalidServerUrlException::class.java) {
      ServerUrlNormalizer.normalize("https://user@cloud.example.test/?path=guess")
    }
  }

  @Test
  fun validatesFlowEndpointWithoutChangingItsQuery() {
    val endpoint = "https://cloud.example.test/login/v2/poll?instance=one"
    assertEquals(endpoint, ServerUrlNormalizer.normalizeEndpoint(endpoint))
    assertThrows(AccountUnsupportedResponseException::class.java) {
      ServerUrlNormalizer.normalizeEndpoint("http://cloud.example.test/poll")
    }
  }
}
