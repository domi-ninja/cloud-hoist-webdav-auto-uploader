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
  val remotePath: String,
  val byteCount: Long,
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

interface DavClient {
  suspend fun upload(request: DavUploadRequest)
}

interface EngineDatabase {
  suspend fun queuedUploads(): List<QueuedUpload>
}

interface WorkScheduler {
  suspend fun enqueue(request: WorkRequest)
}
