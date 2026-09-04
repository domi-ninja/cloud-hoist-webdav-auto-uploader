package ninja.domi.webdavautoupload.engine

import expo.modules.kotlin.exception.CodedException
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.security.cert.CertificateException
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.SSLPeerUnverifiedException
import okhttp3.Credentials
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Response
import okio.BufferedSink
import okio.Buffer
import okio.source

class NextcloudUploadClient(
  private val contentSource: LocalContentSource,
  private val httpClient: OkHttpClient = OkHttpClient(),
  private val uploadId: () -> String = { UUID.randomUUID().toString() },
) : DavClient {
  override fun upload(
    credential: StoredAccountCredential,
    request: DavUploadRequest,
  ): DavUploadResult {
    if (request.isCancelled()) throw TransferCancelledException()
    val remotePath = DavPath.validate(request.remotePathSegments)
    val fileName = DavPath.validateName(request.fileName)
    if (request.byteCount < 0) throw LocalContentInvalidException()
    createParentFolders(credential, remotePath)
    if (request.isCancelled()) throw TransferCancelledException()

    val temporaryName = ".$fileName.webdav-auto-upload-${uploadId()}.part"
    val temporaryUrl = NextcloudDavUrl.file(credential.account, remotePath, temporaryName)
    val destinationUrl = NextcloudDavUrl.file(credential.account, remotePath, fileName)
    try {
      val uploadResponse = putTemporary(credential, request, temporaryUrl)
      if (request.isCancelled()) throw TransferCancelledException()
      moveIntoPlace(credential, temporaryUrl.toString(), destinationUrl.toString())
      return uploadResponse
    } catch (error: CodedException) {
      if (error.isDefiniteFailure()) deleteBestEffort(credential, temporaryUrl.toString())
      throw error
    }
  }

  private fun createParentFolders(
    credential: StoredAccountCredential,
    pathSegments: List<String>,
  ) {
    pathSegments.indices.forEach { index ->
      val request = authenticatedRequest(
        credential,
        NextcloudDavUrl.folder(credential.account, pathSegments.take(index + 1)).toString(),
      ).method("MKCOL", null).build()
      execute(request) { response ->
        if (response.code != 201 && response.code != 405) throwForStatus(response)
      }
    }
  }

  private fun putTemporary(
    credential: StoredAccountCredential,
    upload: DavUploadRequest,
    temporaryUrl: okhttp3.HttpUrl,
  ): DavUploadResult {
    val request = authenticatedRequest(credential, temporaryUrl.toString())
      .put(StreamRequestBody(contentSource, upload))
      .apply {
        upload.modifiedAtEpochSeconds?.let { header("X-OC-Mtime", it.toString()) }
        upload.createdAtEpochSeconds?.let { header("X-OC-CTime", it.toString()) }
      }
      .build()
    return execute(request) { response ->
      if (response.code != 201 && response.code != 204) throwForStatus(response)
      DavUploadResult(
        modificationTimeAccepted = response.header("X-OC-MTime") == "accepted",
        creationTimeAccepted = response.header("X-OC-CTime") == "accepted",
      )
    }
  }

  private fun moveIntoPlace(
    credential: StoredAccountCredential,
    temporaryUrl: String,
    destinationUrl: String,
  ) {
    val request = authenticatedRequest(credential, temporaryUrl)
      .method("MOVE", null)
      .header("Destination", destinationUrl)
      .header("Overwrite", "T")
      .build()
    execute(request) { response ->
      if (response.code != 201 && response.code != 204) throwForStatus(response)
    }
  }

  private fun deleteBestEffort(credential: StoredAccountCredential, temporaryUrl: String) {
    try {
      httpClient.newCall(
        authenticatedRequest(credential, temporaryUrl).delete().build(),
      ).execute().close()
    } catch (_: IOException) {
      // A later queue cleanup can retry a temporary object that could not be removed now.
    }
  }

  private fun authenticatedRequest(credential: StoredAccountCredential, url: String) =
    Request.Builder()
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

  private fun CodedException.isDefiniteFailure() =
    this is AccountInvalidCredentialsException ||
      this is AccountCertificateException ||
      this is DavPermissionException ||
      this is DavNotFoundException ||
      this is DavInvalidPathException ||
      this is DavQuotaException

  private class StreamRequestBody(
    private val source: LocalContentSource,
    private val upload: DavUploadRequest,
  ) : RequestBody() {
    override fun contentType() = upload.mimeType?.toMediaTypeOrNull()
    override fun contentLength() = upload.byteCount

    override fun writeTo(sink: BufferedSink) {
      val input = source.open(upload.localUri) ?: throw LocalContentMissingException()
      input.use {
        val content = it.source()
        val buffer = Buffer()
        var transferred = 0L
        while (true) {
          if (upload.isCancelled()) throw TransferCancelledException()
          val read = content.read(buffer, STREAM_BUFFER_BYTES)
          if (read == -1L) break
          sink.write(buffer, read)
          transferred += read
          upload.onProgress(transferred)
        }
      }
    }

    private companion object {
      const val STREAM_BUFFER_BYTES = 64L * 1_024
    }
  }
}

fun retryAfterMillis(
  value: String?,
  now: Instant = Instant.now(),
): Long? {
  if (value.isNullOrBlank()) return null
  value.toLongOrNull()?.let { seconds ->
    return seconds.coerceAtLeast(0).let { safeSeconds ->
      runCatching { Math.multiplyExact(safeSeconds, 1_000L) }.getOrDefault(Long.MAX_VALUE)
    }
  }
  val retryAt = runCatching {
    ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()
  }.getOrNull() ?: return null
  return (retryAt.toEpochMilli() - now.toEpochMilli()).coerceAtLeast(0)
}
