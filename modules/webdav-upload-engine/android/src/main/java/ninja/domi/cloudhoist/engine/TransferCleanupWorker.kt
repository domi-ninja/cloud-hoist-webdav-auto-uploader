package ninja.domi.cloudhoist.engine

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import kotlin.concurrent.withLock
import okhttp3.OkHttpClient

/** Retried independently of paused uploads; never removes a final destination file. */
class TransferCleanupWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
  override fun doWork(): Result = EngineOperations.lock.withLock {
    val jobId = inputData.getString("jobId") ?: return Result.failure()
    val dao = EngineRoomDatabase.open(applicationContext).engineDao()
    val job = dao.job(jobId) ?: return Result.success()
    val credential = AndroidAccountRepository(applicationContext, dao).credential() ?: return Result.retry()
    if (credential.account.id != job.accountId) return Result.failure()
    val request = DavUploadRequest(
      localUri = "", remotePathSegments = job.remotePathSegments, fileName = job.remoteFileName,
      byteCount = 0, mimeType = null, modifiedAtEpochSeconds = null, createdAtEpochSeconds = null,
    )
    val transport = NextcloudChunkTransport(
      LocalContentSource { null },
      OkHttpClient.Builder().callTimeout(5, TimeUnit.SECONDS).build(),
    )
    try {
      // A drain holds the same lock, so cleanup cannot race a resumed transfer.
      dao.chunkCheckpoint(jobId)?.let {
        transport.abort(credential, it.uploadId, request)
        dao.deleteChunkCheckpoint(jobId)
      }
      transport.abort(credential, jobId, request)
      Result.success()
    } catch (_: Exception) {
      Result.retry()
    }
  }

  companion object {
    fun enqueue(context: Context, jobId: String) {
      val work = OneTimeWorkRequestBuilder<TransferCleanupWorker>()
        .setInputData(Data.Builder().putString("jobId", jobId).build())
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork("transfer-cleanup-$jobId", ExistingWorkPolicy.KEEP, work)
    }
  }
}
