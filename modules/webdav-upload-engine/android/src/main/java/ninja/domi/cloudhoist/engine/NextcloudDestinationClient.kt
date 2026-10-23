package ninja.domi.cloudhoist.engine

import java.io.IOException
import java.security.MessageDigest
import okhttp3.Credentials
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request

/** Destination changes never overwrite an existing file, regardless of the upload collision policy. */
class NextcloudDestinationClient(private val http: OkHttpClient = OkHttpClient()) : DestinationNetworkClient {
  private companion object { const val COLLECTION_ETAG = "cloud-hoist-directory" }
  private val folders = mutableMapOf<List<String>, MutableMap<String, String?>>()
  override fun reset() { folders.clear() }

  override fun etag(credential: StoredAccountCredential, path: List<String>): String? {
    val entries = folders.getOrPut(path.dropLast(1)) {
      try {
        NextcloudInventoryClient(http).listFolder(credential, path.dropLast(1))
          .associate { it.name to if (it.collection) COLLECTION_ETAG else it.etag }.toMutableMap()
      } catch (_: DavNotFoundException) { mutableMapOf() }
    }
    if (path.last() !in entries) return null
    entries[path.last()]?.takeIf(String::isNotBlank)?.let { return it }
    return execute(request(credential, NextcloudDavUrl.file(credential.account, path.dropLast(1), path.last())).head().build()) { response ->
      if (response.code == 404) null else {
        requireSuccess(response.code)
        response.header("ETag")?.takeIf { it.isNotBlank() }
          ?: throw EngineInvalidInputException("Nextcloud did not provide a file version. The file was not moved.")
      }
    }
  }

  /** Hash a conditional stream, never the whole file in memory. ETags are versions, not hashes. */
  override fun hash(credential: StoredAccountCredential, path: List<String>, etag: String): String? {
    if (etag == COLLECTION_ETAG) return null
    val url = NextcloudDavUrl.file(credential.account, path.dropLast(1), path.last())
    return execute(request(credential, url).get().header("If-Match", etag).build()) { response ->
      // Collections can occupy a filename too; they are never duplicate files.
      if (response.code == 405) return@execute null
      requireSuccess(response.code)
      val digest = MessageDigest.getInstance("SHA-256")
      val body = response.body ?: throw AccountUnsupportedResponseException()
      body.byteStream().use { input ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val count = input.read(buffer)
          if (count < 0) break
          digest.update(buffer, 0, count)
        }
      }
      digest.digest().joinToString("") { "%02x".format(it) }
    }
  }

  override fun deleteDuplicate(credential: StoredAccountCredential, from: List<String>, to: List<String>, sourceEtag: String, targetEtag: String) {
    val origin = NextcloudDavUrl.file(credential.account, from.dropLast(1), from.last())
    val target = NextcloudDavUrl.file(credential.account, to.dropLast(1), to.last())
    // Both versions must still exist when the server removes the redundant source.
    val deletion = request(credential, origin).delete().header("If-Match", sourceEtag)
      .header("If", "<$target> ([$targetEtag])").build()
    execute(deletion) { response -> requireSuccess(response.code) }
    folders[from.dropLast(1)]?.remove(from.last())
  }

  override fun ensureFolder(credential: StoredAccountCredential, path: List<String>) {
    val folders = NextcloudDavClient(http)
    path.indices.forEach { index -> folders.createFolder(credential, path.take(index), path[index]) }
  }

  override fun relocate(credential: StoredAccountCredential, from: List<String>, to: List<String>, etag: String, copy: Boolean) {
    val origin = NextcloudDavUrl.file(credential.account, from.dropLast(1), from.last())
    val target = NextcloudDavUrl.file(credential.account, to.dropLast(1), to.last())
    val request = request(credential, origin).method(if (copy) "COPY" else "MOVE", null)
      .header("Destination", target.toString()).header("Overwrite", "F").header("If-Match", etag).build()
    execute(request) { response -> requireSuccess(response.code) }
    if (!copy) folders[from.dropLast(1)]?.remove(from.last())
    folders[to.dropLast(1)]?.set(to.last(), etag)
  }

  private fun request(credential: StoredAccountCredential, url: HttpUrl) = Request.Builder().url(url)
    .header("Authorization", Credentials.basic(credential.account.loginName, credential.appPassword, Charsets.UTF_8))
    .header("User-Agent", "Cloud Hoist (Android)")

  private fun requireSuccess(code: Int) {
    if (code in 200..299) return
    when (code) {
      401 -> throw AccountInvalidCredentialsException()
      403 -> throw DavPermissionException()
      404 -> throw DavNotFoundException()
      409 -> throw DavInvalidPathException()
      412 -> { reset(); throw DestinationPreconditionException() }
      423 -> throw EngineInvalidInputException("Nextcloud has locked this file. Retry when it is unlocked.")
      507 -> throw DavQuotaException()
      else -> throw EngineInvalidInputException("Nextcloud could not move the file (HTTP $code).")
    }
  }

  private fun <T> execute(request: Request, read: (okhttp3.Response) -> T): T = try {
    http.newCall(request).execute().use(read)
  } catch (_: IOException) { throw AccountNetworkException() }
}
