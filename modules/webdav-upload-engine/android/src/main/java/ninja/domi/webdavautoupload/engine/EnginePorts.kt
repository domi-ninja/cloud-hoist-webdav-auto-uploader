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
  val isCancelled: () -> Boolean = { false },
  val onProgress: (uploadedBytes: Long) -> Unit = {},
)

data class DavUploadResult(
  val modificationTimeAccepted: Boolean,
  val creationTimeAccepted: Boolean,
)

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
