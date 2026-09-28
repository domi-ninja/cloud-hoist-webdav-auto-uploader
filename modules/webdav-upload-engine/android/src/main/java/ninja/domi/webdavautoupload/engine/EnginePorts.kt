package ninja.domi.webdavautoupload.engine

data class StoredAccount(
  val id: String,
  val serverUrl: String,
  val loginName: String,
  val davUserId: String,
  val displayName: String,
  val checkedAt: String,
  val capabilities: AccountCapabilities,
)

data class AccountCapabilities(
  val serverVersion: String,
  val chunkingSupported: Boolean,
  val maxChunkSize: Long?,
)

data class StoredAccountCredential(
  val account: StoredAccount,
  val appPassword: String,
)

data class DavUploadRequest(
  val localUri: String,
  val remotePathSegments: List<String>,
  val fileName: String,
  val byteCount: Long,
  val mimeType: String?,
  val modifiedAtEpochSeconds: Long?,
  val createdAtEpochSeconds: Long?,
  // A queued revision keeps this ID across attempts and process restarts.
  val transferId: String? = null,
  val collisionPolicy: CollisionPolicy = CollisionPolicy.REPLACE,
  val isCancelled: () -> Boolean = { false },
  val onProgress: (uploadedBytes: Long) -> Unit = {},
)

data class DavUploadResult(
  val modificationTimeAccepted: Boolean,
  val creationTimeAccepted: Boolean,
  val remoteFileName: String? = null,
)

enum class CollisionPolicy(val value: String) {
  REPLACE("replace"),
  KEEP_BOTH("keep_both");

  companion object {
    fun fromValue(value: String): CollisionPolicy = entries.find { it.value == value }
      ?: throw EngineInvalidInputException("Collision policy is invalid.")
  }
}

internal fun keepBothFileName(fileName: String, copyNumber: Int): String {
  require(copyNumber > 0)
  val dot = fileName.lastIndexOf('.').takeIf { it > 0 } ?: fileName.length
  val numberedSuffix = copyNumber.toString().padStart(3, '0')
  return "${fileName.substring(0, dot)}.$numberedSuffix${fileName.substring(dot)}"
}

data class QueuedUpload(
  val id: String,
  val sourceId: String,
  val localUri: String,
  val remotePath: String,
)

data class WorkRequest(
  val reason: String,
)

interface AccountRepository {
  fun currentAccount(): StoredAccount?
  fun credential(): StoredAccountCredential?
  fun save(credential: StoredAccountCredential)
  fun clear()
}

fun interface DavClient {
  fun upload(credential: StoredAccountCredential, request: DavUploadRequest): DavUploadResult
}

fun interface LocalContentSource {
  fun open(uri: String): java.io.InputStream?
}

interface EngineDatabase {
  suspend fun queuedUploads(): List<QueuedUpload>
}

interface WorkScheduler {
  suspend fun enqueue(request: WorkRequest)
}
