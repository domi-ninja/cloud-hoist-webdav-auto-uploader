package ninja.domi.webdavautoupload.engine

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.security.cert.CertificateException
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.SSLPeerUnverifiedException
import javax.xml.parsers.DocumentBuilderFactory
import okhttp3.Credentials
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Response
import okio.Buffer
import okio.BufferedSink
import okio.source
import org.w3c.dom.Element

/** The stateless HTTP half of Nextcloud chunked-upload v2. */
class NextcloudChunkTransport(
  private val contentSource: LocalContentSource,
  private val httpClient: OkHttpClient = OkHttpClient(),
) {
  fun createSession(
    credential: StoredAccountCredential,
    uploadId: String,
    request: DavUploadRequest,
  ) {
    createParentFolders(credential, request.remotePathSegments)
    val destination = stagingUrl(credential.account, uploadId, request)
    val networkRequest = authenticatedRequest(
      credential,
      NextcloudDavUrl.uploadFolder(credential.account, uploadId),
    ).method("MKCOL", null)
      .header("Destination", destination.toString())
      .build()
    execute(networkRequest) { response ->
      if (response.code != 201 && response.code != 405) throwForStatus(response)
    }
  }

  /** Returns null when Nextcloud has expired or removed the upload session. */
  fun listChunks(
    credential: StoredAccountCredential,
    uploadId: String,
    request: DavUploadRequest,
  ): Set<String>? {
    val destination = stagingUrl(credential.account, uploadId, request)
    val networkRequest = authenticatedRequest(
      credential,
      NextcloudDavUrl.uploadFolder(credential.account, uploadId),
    ).method("PROPFIND", EMPTY_BODY)
      .header("Depth", "1")
      .header("Destination", destination.toString())
      .build()
    return execute(networkRequest) { response ->
      when (response.code) {
        404 -> null
        207 -> ChunkListing.decode(response.body?.string().orEmpty())
        else -> throwForStatus(response)
      }
    }
  }

  fun uploadChunk(
    credential: StoredAccountCredential,
    uploadId: String,
    request: DavUploadRequest,
    chunk: UploadChunk,
  ) {
    val destination = stagingUrl(credential.account, uploadId, request)
    val networkRequest = authenticatedRequest(
      credential,
      NextcloudDavUrl.uploadChunk(credential.account, uploadId, chunk.name),
    ).put(ChunkRequestBody(contentSource, request, chunk))
      .header("Destination", destination.toString())
      .header("OC-Total-Length", request.byteCount.toString())
      .build()
    execute(networkRequest) { response ->
      if (response.code != 201 && response.code != 204) throwForStatus(response)
    }
  }

  fun finalize(
    credential: StoredAccountCredential,
    uploadId: String,
    request: DavUploadRequest,
  ): DavUploadResult {
    val account = credential.account
    val staged = stagingUrl(account, uploadId, request)
    val destination = NextcloudDavUrl.file(
      account,
      DavPath.validate(request.remotePathSegments),
      DavPath.validateName(request.fileName),
    )
    val assemble = authenticatedRequest(
      credential,
      NextcloudDavUrl.uploadAssembly(account, uploadId),
    ).method("MOVE", null)
      .header("Destination", staged.toString())
      .header("Overwrite", "T")
      .header("OC-Total-Length", request.byteCount.toString())
      .apply {
        request.modifiedAtEpochSeconds?.let { header("X-OC-Mtime", it.toString()) }
        request.createdAtEpochSeconds?.let { header("X-OC-CTime", it.toString()) }
      }
      .build()
    val timestamps = execute(assemble) { response ->
      if (response.code != 201 && response.code != 204) throwForStatus(response)
      DavUploadResult(
        modificationTimeAccepted = response.header("X-OC-MTime") == "accepted",
        creationTimeAccepted = response.header("X-OC-CTime") == "accepted",
      )
    }
    if (request.isCancelled()) throw TransferCancelledException()

    val replace = authenticatedRequest(credential, staged)
      .method("MOVE", null)
      .header("Destination", destination.toString())
      .header("Overwrite", "T")
      .build()
    execute(replace) { response ->
      if (response.code != 201 && response.code != 204) throwForStatus(response)
    }
    return timestamps
  }

  fun abort(credential: StoredAccountCredential, uploadId: String) {
    val request = authenticatedRequest(
      credential,
      NextcloudDavUrl.uploadFolder(credential.account, uploadId),
    ).delete().build()
    execute(request) { response ->
      if (response.code !in listOf(204, 404)) throwForStatus(response)
    }
  }

  private fun createParentFolders(
    credential: StoredAccountCredential,
    pathSegments: List<String>,
  ) {
    val path = DavPath.validate(pathSegments)
    path.indices.forEach { index ->
      val request = authenticatedRequest(
        credential,
        NextcloudDavUrl.folder(credential.account, path.take(index + 1)),
      ).method("MKCOL", null).build()
      execute(request) { response ->
        if (response.code != 201 && response.code != 405) throwForStatus(response)
      }
    }
  }

  private fun stagingUrl(
    account: StoredAccount,
    uploadId: String,
    request: DavUploadRequest,
  ): HttpUrl {
    val fileName = DavPath.validateName(request.fileName)
    return NextcloudDavUrl.file(
      account,
      DavPath.validate(request.remotePathSegments),
      ".$fileName.webdav-auto-upload-$uploadId.part",
    )
  }

  private fun authenticatedRequest(
    credential: StoredAccountCredential,
    url: HttpUrl,
  ) = Request.Builder()
    .url(url)
    .header(
      "Authorization",
      Credentials.basic(credential.account.loginName, credential.appPassword, Charsets.UTF_8),
    )
    .header("User-Agent", "WebDAV Auto Upload/0.1 (Android)")

  private fun throwForStatus(response: Response): Nothing = when (response.code) {
    401 -> throw AccountInvalidCredentialsException()
    403 -> throw DavPermissionException()
    404 -> throw DavNotFoundException()
    409, 412 -> throw DavInvalidPathException()
    423 -> throw DavLockedException()
    429 -> throw DavRateLimitedException(retryAfterMillis(response.header("Retry-After")))
    507 -> throw DavQuotaException()
    in 500..599 -> throw AccountServerException()
    else -> throw AccountUnsupportedResponseException()
  }

  private fun <T> execute(request: Request, read: (Response) -> T): T = try {
    httpClient.newCall(request).execute().use(read)
  } catch (error: SSLHandshakeException) {
    if (generateSequence(error as Throwable?) { it.cause }.any { it is CertificateException }) {
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

  private class ChunkRequestBody(
    private val source: LocalContentSource,
    private val upload: DavUploadRequest,
    private val chunk: UploadChunk,
  ) : RequestBody() {
    override fun contentType() = upload.mimeType?.toMediaTypeOrNull()
    override fun contentLength() = chunk.byteCount

    override fun writeTo(sink: BufferedSink) {
      val input = source.open(upload.localUri) ?: throw LocalContentMissingException()
      input.use {
        var skipped = 0L
        while (skipped < chunk.offset) {
          if (upload.isCancelled()) throw TransferCancelledException()
          val step = it.skip(chunk.offset - skipped)
          if (step > 0) {
            skipped += step
          } else if (it.read() == -1) {
            throw LocalContentInvalidException()
          } else {
            skipped += 1
          }
        }

        val content = it.source()
        val buffer = Buffer()
        var remaining = chunk.byteCount
        while (remaining > 0) {
          if (upload.isCancelled()) throw TransferCancelledException()
          val read = content.read(buffer, minOf(STREAM_BUFFER_BYTES, remaining))
          if (read == -1L) throw LocalContentInvalidException()
          sink.write(buffer, read)
          remaining -= read
        }
      }
    }
  }

  private object ChunkListing {
    fun decode(xml: String): Set<String> {
      if (xml.isBlank()) throw AccountUnsupportedResponseException()
      val factory = DocumentBuilderFactory.newInstance().apply {
        isNamespaceAware = true
        setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        setFeature("http://xml.org/sax/features/external-general-entities", false)
        setFeature("http://xml.org/sax/features/external-parameter-entities", false)
      }
      val document = try {
        factory.newDocumentBuilder().parse(xml.byteInputStream())
      } catch (_: Exception) {
        throw AccountUnsupportedResponseException()
      }
      val responses = document.getElementsByTagNameNS("DAV:", "response")
      return buildSet {
        for (index in 0 until responses.length) {
          val response = responses.item(index) as? Element ?: continue
          val href = response.getElementsByTagNameNS("DAV:", "href").item(0)?.textContent
            ?: continue
          href.trimEnd('/').substringAfterLast('/').takeIf(::isChunkName)?.let(::add)
        }
      }
    }

    private fun isChunkName(value: String) =
      value.length == CHUNK_NAME_WIDTH && value.all(Char::isDigit) && value != "00000"
  }

  private companion object {
    val EMPTY_BODY = object : RequestBody() {
      override fun contentType() = null
      override fun contentLength() = 0L
      override fun writeTo(sink: BufferedSink) = Unit
    }
    const val STREAM_BUFFER_BYTES = 64L * 1_024
  }
}
