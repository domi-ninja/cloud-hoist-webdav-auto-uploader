package ninja.domi.cloudhoist.engine

import android.content.Context
import android.net.Uri
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.Semaphore
import okhttp3.Credentials
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.w3c.dom.Element

data class RemoteInventoryFile(
  val relativePath: String,
  val mimeType: String?,
  val byteCount: Long?,
  val modifiedAt: Long?,
)

data class RemoteInventoryEntry(
  val name: String,
  val pathSegments: List<String>,
  val collection: Boolean,
  val mimeType: String?,
  val byteCount: Long?,
  val modifiedAt: Long?,
)

data class InventoryError(
  val sourceId: String,
  val message: String,
)

data class InventoryPage(
  val items: List<Map<String, Any?>>,
  val errors: List<InventoryError>,
  val nextOffset: Int?,
) {
  fun toMap() = mapOf(
    "items" to items,
    "errors" to errors.map { mapOf("sourceId" to it.sourceId, "message" to it.message) },
    "nextOffset" to nextOffset,
  )
}

interface RemoteInventoryClient {
  fun listFiles(
    credential: StoredAccountCredential,
    rootPathSegments: List<String>,
  ): List<RemoteInventoryFile>
}

class NextcloudInventoryClient(
  private val httpClient: OkHttpClient = OkHttpClient(),
) : RemoteInventoryClient {
  override fun listFiles(
    credential: StoredAccountCredential,
    rootPathSegments: List<String>,
  ): List<RemoteInventoryFile> {
    val files = mutableListOf<RemoteInventoryFile>()
    val pending = ArrayDeque<List<String>>().apply { add(rootPathSegments) }
    while (pending.isNotEmpty()) {
      val folder = pending.removeFirst()
      list(credential, folder).forEach { entry ->
        if (entry.collection) {
          pending.add(entry.pathSegments)
        } else {
          files += RemoteInventoryFile(
            relativePath = entry.pathSegments.drop(rootPathSegments.size).joinToString("/"),
            mimeType = entry.mimeType,
            byteCount = entry.byteCount,
            modifiedAt = entry.modifiedAt,
          )
        }
      }
    }
    return files
  }

  private fun list(
    credential: StoredAccountCredential,
    pathSegments: List<String>,
  ): List<RemoteInventoryEntry> {
    val url = NextcloudDavUrl.folder(credential.account, pathSegments)
    val request = Request.Builder()
      .url(url)
      .header(
        "Authorization",
        Credentials.basic(
          credential.account.loginName,
          credential.appPassword,
          Charsets.UTF_8,
        ),
      )
      .header("User-Agent", "Cloud Hoist/0.1 (Android)")
      .header("Depth", "1")
      .method("PROPFIND", INVENTORY_BODY.toRequestBody(XML_MEDIA_TYPE))
      .build()
    return execute(request) { response ->
      if (response.code != 207) throwDavStatus(response.code)
      RemoteInventoryXmlDecoder.decode(response.body?.string().orEmpty(), url, pathSegments)
    }
  }

  private fun <T> execute(request: Request, read: (okhttp3.Response) -> T): T = try {
    httpClient.newCall(request).execute().use(read)
  } catch (_: IOException) {
    throw AccountNetworkException()
  }

  private fun throwDavStatus(statusCode: Int): Nothing = when (statusCode) {
    401 -> throw AccountInvalidCredentialsException()
    403 -> throw DavPermissionException()
    404 -> throw DavNotFoundException()
    507 -> throw DavQuotaException()
    in 500..599 -> throw AccountServerException()
    else -> throw AccountUnsupportedResponseException()
  }

  private companion object {
    val XML_MEDIA_TYPE = "application/xml; charset=utf-8".toMediaType()
    const val INVENTORY_BODY =
      """<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontenttype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>"""
  }
}

object RemoteInventoryXmlDecoder {
  fun decode(
    xml: String,
    requestUrl: HttpUrl,
    parentPath: List<String>,
  ): List<RemoteInventoryEntry> {
    val document = parseDavXml(xml)
    val requestedSegments = requestUrl.pathSegments.dropLastWhile(String::isEmpty)
    val responses = document.getElementsByTagNameNS("DAV:", "response")
    return buildList {
      for (index in 0 until responses.length) {
        val response = responses.item(index) as? Element ?: continue
        val href = response.getElementsByTagNameNS("DAV:", "href").item(0)?.textContent ?: continue
        val childSegments = requestUrl.resolve(href)?.pathSegments
          ?.dropLastWhile(String::isEmpty)
          ?: continue
        if (
          childSegments.size != requestedSegments.size + 1 ||
          childSegments.take(requestedSegments.size) != requestedSegments
        ) continue
        val name = childSegments.last()
        add(
          RemoteInventoryEntry(
            name = name,
            pathSegments = parentPath + name,
            collection = response.getElementsByTagNameNS("DAV:", "collection").length > 0,
            mimeType = property(response, "getcontenttype"),
            byteCount = property(response, "getcontentlength")?.toLongOrNull(),
            modifiedAt = property(response, "getlastmodified")?.let { value ->
              runCatching {
                ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME)
                  .toInstant().toEpochMilli()
              }.getOrNull()
            },
          ),
        )
      }
    }.distinctBy(RemoteInventoryEntry::pathSegments)
  }

  private fun property(response: Element, name: String) =
    response.getElementsByTagNameNS("DAV:", name).item(0)?.textContent?.trim()
      ?.takeIf(String::isNotEmpty)
}

class FileInventoryManager(
  private val dao: EngineDao,
  private val accountRepository: AccountRepository,
  private val remoteClient: RemoteInventoryClient,
) {
  private data class CachedRemote(val files: List<RemoteInventoryFile>, val loadedAt: Long)
  private val remoteCache = mutableMapOf<List<String>, CachedRemote>()

  /** Pages share one short-lived DAV listing instead of downloading the whole folder per page. */
  @Synchronized
  private fun remoteFiles(credential: StoredAccountCredential, source: SourceEntity): List<RemoteInventoryFile> {
    val key = listOf(credential.account.id, credential.account.serverUrl, credential.account.davUserId, source.id) + source.remotePathSegments
    val now = System.currentTimeMillis()
    remoteCache.entries.removeAll { now - it.value.loadedAt >= 10_000 }
    remoteCache[key]?.let { return it.files }
    return remoteClient.listFiles(credential, source.remotePathSegments).also {
      remoteCache[key] = CachedRemote(it, System.currentTimeMillis())
    }
  }

  fun page(offset: Int, pageSize: Int = PAGE_SIZE, filter: InventoryFilter = InventoryFilter()): InventoryPage {
    require(offset >= 0)
    val credential = accountRepository.credential() ?: throw AccountNotConfiguredException()
    val locals = dao.localInventory().groupBy(LocalInventoryView::sourceId)
    val errors = mutableListOf<InventoryError>()
    val items = dao.allSources().filter { filter.sourceId == null || it.id == filter.sourceId }.flatMap { source ->
      val remote = try {
        remoteFiles(credential, source)
      } catch (error: Exception) {
        errors += InventoryError(
          source.id,
          error.message?.takeIf(String::isNotBlank) ?: "Nextcloud files could not be loaded.",
        )
        emptyList()
      }
      reconcileInventory(source, locals[source.id].orEmpty(), remote)
    }.sortedWith(
      compareByDescending<Map<String, Any?>> { it["modifiedAt"] as? String }
        .thenBy { it["relativePath"] as String },
    )
    return inventoryPage(items, errors, offset, pageSize, filter)
  }
}

class InventoryFilterRecord : Record {
  @Field val sourceId: String? = null
  @Field val status: String = "all"

  fun toFilter(): InventoryFilter {
    if (status !in setOf("all", "pending", "failed", "uploaded")) {
      throw EngineInvalidInputException("File status filter is invalid.")
    }
    return InventoryFilter(sourceId, status)
  }
}

data class InventoryFilter(val sourceId: String? = null, val status: String = "all") {
  fun matches(item: Map<String, Any?>): Boolean {
    if (sourceId != null && item["sourceId"] != sourceId) return false
    val transfer = (item["transfer"] as? Map<*, *>)?.get("status")
    return when (status) {
      "pending" -> transfer == "queued" || transfer == "uploading"
      "failed" -> transfer == "failed"
      "uploaded" -> transfer == "uploaded"
      else -> true
    }
  }
}

internal fun inventoryPage(
  items: List<Map<String, Any?>>,
  errors: List<InventoryError>,
  offset: Int,
  pageSize: Int,
  filter: InventoryFilter = InventoryFilter(),
): InventoryPage {
  require(offset >= 0 && pageSize > 0)
  val matching = items.filter(filter::matches)
  val pageItems = matching.drop(offset).take(pageSize)
  return InventoryPage(
    items = pageItems,
    errors = errors,
    nextOffset = if (offset + pageItems.size < matching.size) offset + pageItems.size else null,
  )
}

private val uploadStagingName = Regex("^\\..+\\.cloud-hoist-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

internal fun reconcileInventory(
  source: SourceEntity,
  localFiles: List<LocalInventoryView>,
  remoteFiles: List<RemoteInventoryFile>,
): List<Map<String, Any?>> {
  val localByRemotePath = localFiles.associateBy(::targetRelativePath)
  val remoteByPath = remoteFiles.associateBy(RemoteInventoryFile::relativePath)
  // A temporary upload is not a second remote photo. Keep ordinary hidden/local files visible.
  return (localByRemotePath.keys + remoteByPath.keys).filterNot { path ->
    path !in localByRemotePath && uploadStagingName.matches(path.substringAfterLast('/'))
  }.map { relativePath ->
    val local = localByRemotePath[relativePath]
    val remote = remoteByPath[relativePath]
    val modifiedAt = maxOfOrNull(
      local?.modifiedAt?.times(1_000),
      remote?.modifiedAt,
      local?.jobCompletedAt,
    )
    mapOf(
      "id" to "${source.id}:$relativePath",
      "sourceId" to source.id,
      "sourceName" to source.name,
      "fileName" to relativePath.substringAfterLast('/'),
      "relativePath" to relativePath,
      "remotePath" to (source.remotePathSegments + relativePath.split('/'))
        .joinToString("/", prefix = "/"),
      "localUri" to local?.localUri,
      "mimeType" to (local?.mimeType ?: remote?.mimeType),
      "byteCount" to (local?.byteCount ?: remote?.byteCount),
      "modifiedAt" to modifiedAt?.let { Instant.ofEpochMilli(it).toString() },
      "presence" to when {
        local != null && remote != null -> "both"
        local != null -> "local_only"
        else -> "remote_only"
      },
      "transfer" to local?.jobState?.let { transferMap(local) },
    )
  }
}

private fun targetRelativePath(local: LocalInventoryView): String {
  val jobPath = local.jobRemotePathSegments
  val jobName = local.jobRemoteFileName
  if (jobPath != null && jobName != null) {
    val relativeFolder = jobPath.drop(local.sourceRemotePathSegments.size)
    return (relativeFolder + jobName).joinToString("/")
  }
  return local.localRelativePath
}

private fun transferMap(local: LocalInventoryView): Map<String, Any?> = when (local.jobState) {
  JobState.QUEUED -> mapOf("status" to "queued")
  JobState.RUNNING -> mapOf("status" to "uploading", "bytesSent" to 0)
  JobState.COMPLETED -> mapOf(
    "status" to "uploaded",
    "uploadedAt" to Instant.ofEpochMilli(local.jobCompletedAt ?: 0).toString(),
  )
  JobState.RETRY_WAIT -> mapOf(
    "status" to "failed",
    "code" to (local.jobLastErrorCode ?: "retry_wait"),
    "retryable" to true,
  )
  else -> mapOf(
    "status" to "failed",
    "code" to (local.jobLastErrorCode ?: local.jobState ?: "blocked"),
    "retryable" to false,
  )
}

private fun maxOfOrNull(vararg values: Long?): Long? = values.filterNotNull().maxOrNull()

private const val PAGE_SIZE = 20

class RemoteThumbnailManager(
  context: Context,
  private val dao: EngineDao,
  private val accountRepository: AccountRepository,
  private val httpClient: OkHttpClient = OkHttpClient(),
) {
  private val cacheDirectory = File(context.cacheDir, "nextcloud-previews")
  private val permits = Semaphore(3)

  fun thumbnail(sourceId: String, relativePath: String, version: String?): String? {
    val source = dao.source(sourceId) ?: throw EngineSourceNotFoundException(sourceId)
    val credential = accountRepository.credential() ?: throw AccountNotConfiguredException()
    val key = MessageDigest.getInstance("SHA-256")
      .digest("$sourceId:$relativePath:${version.orEmpty()}".toByteArray())
      .joinToString("") { "%02x".format(it) }
    val target = File(cacheDirectory, "$key.preview")
    if (target.isFile && target.length() in 1..MAX_PREVIEW_BYTES) {
      target.setLastModified(System.currentTimeMillis())
      return Uri.fromFile(target).toString()
    }
    permits.acquire()
    try {
      if (target.isFile && target.length() in 1..MAX_PREVIEW_BYTES) {
        target.setLastModified(System.currentTimeMillis())
        return Uri.fromFile(target).toString()
      }
      val account = credential.account
      val filePath = (source.remotePathSegments + relativePath.split('/'))
        .joinToString("/", prefix = "/")
      val url = account.serverUrl.toHttpUrl().newBuilder()
        .addPathSegments("index.php/core/preview.png")
        .addQueryParameter("file", filePath)
        .addQueryParameter("x", "128")
        .addQueryParameter("y", "128")
        .addQueryParameter("a", "1")
        .addQueryParameter("mode", "cover")
        .build()
      val request = Request.Builder()
        .url(url)
        .header(
          "Authorization",
          Credentials.basic(account.loginName, credential.appPassword, Charsets.UTF_8),
        )
        .header("User-Agent", "Cloud Hoist/0.1 (Android)")
        .build()
      val bytes = httpClient.newCall(request).execute().use { response ->
        if (response.code == 404) return null
        if (!response.isSuccessful || response.body == null) return null
        val body = checkNotNull(response.body)
        if (body.contentLength() > MAX_PREVIEW_BYTES) return null
        body.byteStream().readNBytes(MAX_PREVIEW_BYTES + 1).takeIf {
          it.isNotEmpty() && it.size <= MAX_PREVIEW_BYTES
        } ?: return null
      }
      cacheDirectory.mkdirs()
      target.writeBytes(bytes)
      pruneCache()
      return Uri.fromFile(target).toString()
    } finally {
      permits.release()
    }
  }

  private fun pruneCache() {
    var bytes = 0L
    cacheDirectory.listFiles().orEmpty()
      .filter(File::isFile)
      .sortedByDescending(File::lastModified)
      .forEachIndexed { index, file ->
        bytes += file.length()
        if (index >= MAX_PREVIEW_FILES || bytes > MAX_CACHE_BYTES) file.delete()
      }
  }

  private companion object {
    const val MAX_PREVIEW_BYTES = 1_048_576
    const val MAX_PREVIEW_FILES = 128
    const val MAX_CACHE_BYTES = 16L * 1_048_576
  }
}
