package ninja.domi.webdavautoupload.engine

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.security.cert.CertificateException
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.SSLPeerUnverifiedException
import okhttp3.Credentials
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

interface AccountNetworkClient {
  fun startLoginFlow(serverUrl: String): LoginFlowRequest
  fun pollLoginFlow(endpoint: String, token: String): LoginFlowCredentials?
  fun resolveUser(serverUrl: String, loginName: String, appPassword: String): NextcloudUser
  fun capabilities(serverUrl: String, loginName: String, appPassword: String): AccountCapabilities
}

class NextcloudClient(
  private val httpClient: OkHttpClient = OkHttpClient.Builder()
    .followRedirects(false)
    .followSslRedirects(false)
    .callTimeout(20, TimeUnit.SECONDS)
    .build(),
) : AccountNetworkClient {
  override fun startLoginFlow(serverUrl: String): LoginFlowRequest {
    val request = baseRequest("$serverUrl/index.php/login/v2")
      .post(ByteArray(0).toRequestBody())
      .build()

    return execute(request) { response ->
      requireSuccess(response)
      NextcloudJsonDecoder.decodeLoginFlowStart(requiredBody(response))
    }
  }

  override fun pollLoginFlow(endpoint: String, token: String): LoginFlowCredentials? {
    val request = baseRequest(endpoint)
      .post(FormBody.Builder().add("token", token).build())
      .build()

    return execute(request) { response ->
      when (response.code) {
        404 -> null
        200 -> NextcloudJsonDecoder.decodeLoginFlowCredentials(requiredBody(response))
        else -> throwForStatus(response.code)
      }
    }
  }

  override fun resolveUser(
    serverUrl: String,
    loginName: String,
    appPassword: String,
  ): NextcloudUser = authenticatedGet(
    "$serverUrl/ocs/v2.php/cloud/user?format=json",
    loginName,
    appPassword,
    NextcloudJsonDecoder::decodeUser,
  )

  override fun capabilities(
    serverUrl: String,
    loginName: String,
    appPassword: String,
  ): AccountCapabilities = authenticatedGet(
    "$serverUrl/ocs/v2.php/cloud/capabilities?format=json",
    loginName,
    appPassword,
    NextcloudJsonDecoder::decodeCapabilities,
  )

  private fun <T> authenticatedGet(
    url: String,
    loginName: String,
    appPassword: String,
    decode: (String) -> T,
  ): T {
    val request = baseRequest(url)
      .header("Authorization", Credentials.basic(loginName, appPassword, Charsets.UTF_8))
      .header("OCS-APIRequest", "true")
      .get()
      .build()

    return execute(request) { response ->
      requireSuccess(response)
      decode(requiredBody(response))
    }
  }

  private fun baseRequest(url: String) = Request.Builder()
    .url(url)
    .header("Accept", "application/json")
    .header("User-Agent", "WebDAV Auto Upload/0.1 (Android)")

  private fun requireSuccess(response: Response) {
    if (response.code != 200) {
      throwForStatus(response.code)
    }
  }

  private fun requiredBody(response: Response): String =
    response.body?.string()?.takeIf(String::isNotBlank)
      ?: throw AccountUnsupportedResponseException()

  private fun throwForStatus(statusCode: Int): Nothing = when (statusCode) {
    401, 403 -> throw AccountInvalidCredentialsException()
    503 -> throw AccountMaintenanceException()
    in 300..399 -> throw AccountUnexpectedRedirectException()
    in 500..599 -> throw AccountServerException()
    else -> throw AccountUnsupportedResponseException()
  }

  private fun <T> execute(request: Request, read: (Response) -> T): T = try {
    httpClient.newCall(request).execute().use(read)
  } catch (error: SSLHandshakeException) {
    if (error.hasCertificateCause()) {
      throw AccountCertificateException()
    }
    throw AccountNetworkException()
  } catch (_: SSLPeerUnverifiedException) {
    throw AccountCertificateException()
  } catch (_: UnknownHostException) {
    throw AccountDnsException()
  } catch (_: SocketTimeoutException) {
    throw AccountTimeoutException()
  } catch (_: ConnectException) {
    throw AccountConnectionRefusedException()
  } catch (error: IOException) {
    throw AccountNetworkException()
  }

  private fun Throwable.hasCertificateCause(): Boolean =
    generateSequence(this) { it.cause }.any { it is CertificateException }
}
