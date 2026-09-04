package ninja.domi.webdavautoupload.engine

data class StoredAccount(
  val serverUrl: String,
  val username: String,
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
  suspend fun currentAccount(): StoredAccount?
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
