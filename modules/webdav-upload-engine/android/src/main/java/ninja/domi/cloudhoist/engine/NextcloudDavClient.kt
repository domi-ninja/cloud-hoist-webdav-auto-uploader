package ninja.domi.cloudhoist.engine

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.SSLPeerUnverifiedException
import okhttp3.Credentials
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.HttpUrl
import org.w3c.dom.Element

class NextcloudDavClient(
  private val httpClient: OkHttpClient = OkHttpClient(),
) : RemoteFolderNetworkClient {
  override fun listFolders(
    credential: StoredAccountCredential,
    pathSegments: List<String>,
  ): List<RemoteFolder> {
    val url = folderUrl(credential.account, pathSegments)
    val request = authenticatedRequest(url, credential)
      .method("PROPFIND", PROPFIND_BODY.toRequestBody(XML_MEDIA_TYPE))
      .header("Depth", "1")
      .build()

    return execute(request) { response ->
      if (response.code != 207) throwForStatus(response.code)
      RemoteFolderXmlDecoder.decode(requiredBody(response), url, pathSegments)
    }
  }

  override fun createFolder(
    credential: StoredAccountCredential,
    parentPathSegments: List<String>,
    name: String,
  ): RemoteFolder {
    val pathSegments = parentPathSegments + name
    val request = authenticatedRequest(folderUrl(credential.account, pathSegments), credential)
      .method("MKCOL", null)
      .build()

    execute(request) { response ->
      if (response.code != 201 && response.code != 405) throwForStatus(response.code)
    }
    return RemoteFolder(name, pathSegments)
  }

  private fun folderUrl(account: StoredAccount, pathSegments: List<String>): HttpUrl =
    NextcloudDavUrl.folder(account, pathSegments)

  private fun authenticatedRequest(
    url: HttpUrl,
    credential: StoredAccountCredential,
  ) = Request.Builder()
    .url(url)
    .header(
      "Authorization",
      Credentials.basic(credential.account.loginName, credential.appPassword, Charsets.UTF_8),
    )
    .header("User-Agent", "Cloud Hoist/0.1 (Android)")

  private fun requiredBody(response: Response): String =
    response.body?.string()?.takeIf(String::isNotBlank)
      ?: throw AccountUnsupportedResponseException()

  private fun throwForStatus(statusCode: Int): Nothing = when (statusCode) {
    401 -> throw AccountInvalidCredentialsException()
    403 -> throw DavPermissionException()
    404 -> throw DavNotFoundException()
    409 -> throw DavInvalidPathException()
    507 -> throw DavQuotaException()
    in 500..599 -> throw AccountServerException()
    else -> throw AccountUnsupportedResponseException()
  }

  private fun <T> execute(request: Request, read: (Response) -> T): T = try {
    httpClient.newCall(request).execute().use(read)
  } catch (error: SSLHandshakeException) {
    if (generateSequence(error as Throwable?) { it.cause }.any { it is java.security.cert.CertificateException }) {
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
  } catch (_: IOException) {
    throw AccountNetworkException()
  }

  private companion object {
    val XML_MEDIA_TYPE = "application/xml; charset=utf-8".toMediaType()
    const val PROPFIND_BODY =
      """<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>"""
  }
}

object RemoteFolderXmlDecoder {
  fun decode(xml: String, requestUrl: HttpUrl, parentPath: List<String>): List<RemoteFolder> {
    val document = parseDavXml(xml)
    val requestedSegments = requestUrl.pathSegments.dropLastWhile(String::isEmpty)
    val responses = document.getElementsByTagNameNS("DAV:", "response")
    return buildList {
      for (index in 0 until responses.length) {
        val response = responses.item(index) as? Element ?: continue
        if (response.getElementsByTagNameNS("DAV:", "collection").length == 0) continue
        val href = response.getElementsByTagNameNS("DAV:", "href").item(0)?.textContent ?: continue
        val childSegments = requestUrl.resolve(href)?.pathSegments
          ?.dropLastWhile(String::isEmpty)
          ?: continue
        if (
          childSegments.size == requestedSegments.size + 1 &&
          childSegments.take(requestedSegments.size) == requestedSegments
        ) {
          val name = childSegments.last()
          add(RemoteFolder(name, parentPath + name))
        }
      }
    }.distinctBy(RemoteFolder::pathSegments)
  }
}
