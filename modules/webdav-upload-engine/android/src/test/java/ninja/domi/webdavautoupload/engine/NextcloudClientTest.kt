package ninja.domi.webdavautoupload.engine

import java.io.IOException
import javax.net.ssl.SSLPeerUnverifiedException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class NextcloudClientTest {
  @Test
  fun classifiesAuthenticationMaintenanceRedirectAndBodyFailures() {
    assertThrows(AccountInvalidCredentialsException::class.java) {
      statusClient(401).resolveUser(SERVER, "login", SECRET)
    }
    assertThrows(AccountMaintenanceException::class.java) {
      statusClient(503).resolveUser(SERVER, "login", SECRET)
    }
    assertThrows(AccountUnexpectedRedirectException::class.java) {
      statusClient(302).resolveUser(SERVER, "login", SECRET)
    }
    assertThrows(AccountUnsupportedResponseException::class.java) {
      statusClient(200, "<html>not OCS</html>").resolveUser(SERVER, "login", SECRET)
    }
  }

  @Test
  fun classifiesCertificateAndNetworkFailuresWithoutLeakingSecrets() {
    val certificateError = assertThrows(AccountCertificateException::class.java) {
      throwingClient(SSLPeerUnverifiedException("certificate detail"))
        .resolveUser(SERVER, "login", SECRET)
    }
    val networkError = assertThrows(AccountNetworkException::class.java) {
      throwingClient(IOException("request failed with $SECRET"))
        .resolveUser(SERVER, "login", SECRET)
    }

    listOf(certificateError, networkError).forEach { error ->
      assertFalse(error.message.orEmpty().contains(SECRET))
      assertFalse(error.message.orEmpty().contains("Authorization", ignoreCase = true))
    }
  }

  @Test
  fun aNotFoundLoginPollIsStillPending() {
    val client = statusClient(404)
    val result = client.pollLoginFlow("https://cloud.example.test/login/v2/poll", SECRET)
    assertNull(result)
  }

  private fun statusClient(code: Int, body: String = "") = NextcloudClient(
    OkHttpClient.Builder()
      .addInterceptor { chain -> response(chain.request(), code, body) }
      .build(),
  )

  private fun throwingClient(error: IOException) = NextcloudClient(
    OkHttpClient.Builder()
      .addInterceptor { throw error }
      .build(),
  )

  private fun response(request: Request, code: Int, body: String) = Response.Builder()
    .request(request)
    .protocol(Protocol.HTTP_1_1)
    .code(code)
    .message("fixture")
    .body(body.toResponseBody("application/json".toMediaType()))
    .build()

  private companion object {
    const val SERVER = "https://cloud.example.test"
    const val SECRET = "never-log-this-app-password"
  }
}
