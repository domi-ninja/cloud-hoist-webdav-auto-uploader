package ninja.domi.cloudhoist.engine

import android.net.Uri
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import okhttp3.Credentials
import okhttp3.OkHttpClient
import okhttp3.Request

/** Original images stay in a bounded private cache. Credentials never cross the JS bridge. */
class RemoteImageManager(
  private val cacheDirectory: File,
  private val dao: EngineDao,
  private val accountRepository: AccountRepository,
  private val httpClient: OkHttpClient = OkHttpClient.Builder().callTimeout(30, TimeUnit.SECONDS).build(),
  private val maxImageBytes: Long = 50L * 1_048_576,
) {
  private val permit = Semaphore(1)

  fun image(sourceId: String, relativePath: String, version: String?): String {
    val parts = relativePath.split('/')
    require(parts.none { it.isBlank() || it == "." || it == ".." }) { "Invalid image path." }
    val source = dao.source(sourceId) ?: throw EngineSourceNotFoundException(sourceId)
    val credential = accountRepository.credential() ?: throw AccountNotConfiguredException()
    require(source.accountId == credential.account.id) { "The backup belongs to another account." }
    val url = NextcloudDavUrl.file(credential.account, source.remotePathSegments + parts.dropLast(1), parts.last())
    val key = MessageDigest.getInstance("SHA-256")
      .digest("${credential.account.id}:$url:${version.orEmpty()}".toByteArray())
      .joinToString("") { "%02x".format(it) }
    val target = File(cacheDirectory, "$key.image")
    permit.acquire()
    try {
      if (target.isFile && target.length() in 1..maxImageBytes) {
        target.setLastModified(System.currentTimeMillis())
        return Uri.fromFile(target).toString()
      }
      cacheDirectory.mkdirs()
      cacheDirectory.listFiles().orEmpty().filter { it.extension == "part" }.forEach(File::delete)
      val temporary = File.createTempFile("download-", ".part", cacheDirectory)
      try {
        val request = Request.Builder().url(url)
          .header("Authorization", Credentials.basic(credential.account.loginName, credential.appPassword, Charsets.UTF_8))
          .build()
        httpClient.newCall(request).execute().use { response ->
          if (!response.isSuccessful) throw IOException("Image download failed (${response.code}).")
          val body = response.body ?: throw IOException("Image response was empty.")
          if (body.contentLength() > maxImageBytes) throw IOException("Image is too large to preview.")
          body.byteStream().use { input ->
            temporary.outputStream().use { output ->
              val buffer = ByteArray(8192)
              var total = 0L
              while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > maxImageBytes) throw IOException("Image is too large to preview.")
                output.write(buffer, 0, count)
              }
              if (total == 0L) throw IOException("Image response was empty.")
            }
          }
        }
        if (!temporary.renameTo(target)) throw IOException("Image could not be cached.")
      } finally {
        temporary.delete()
      }
      var bytes = 0L
      cacheDirectory.listFiles().orEmpty().filter { it.extension == "image" }
        .sortedByDescending(File::lastModified).forEachIndexed { index, file ->
          bytes += file.length()
          if (index >= 16 || bytes > 64L * 1_048_576) file.delete()
        }
      return Uri.fromFile(target).toString()
    } finally {
      permit.release()
    }
  }
}
