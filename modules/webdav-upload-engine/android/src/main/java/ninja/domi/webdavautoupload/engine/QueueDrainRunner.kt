package ninja.domi.webdavautoupload.engine

import android.content.Context
import android.net.Uri
import java.util.UUID
import java.util.concurrent.TimeUnit

data class QueueDrainResult(
  val completedJobs: Int,
  val retryWorker: Boolean,
)

/** Claims and uploads a small batch. Room owns every state transition before this returns. */
class QueueDrainRunner(
  private val dao: EngineDao,
  private val accountRepository: AccountRepository,
  private val davClient: DavClient,
  private val mimeType: (String) -> String?,
  private val isPaused: () -> Boolean,
  private val isStopped: () -> Boolean = { false },
  private val newId: () -> String = { UUID.randomUUID().toString() },
  private val now: () -> Long = System::currentTimeMillis,
  private val elapsed: () -> Long = android.os.SystemClock::elapsedRealtime,
  private val maxJobs: Int = DEFAULT_MAX_JOBS,
  private val maxRunMillis: Long = DEFAULT_MAX_RUN_MILLIS,
) {
  fun run(): QueueDrainResult {
    val startedAt = elapsed()
    dao.recoverAbandoned(now() - ABANDONED_AFTER_MILLIS)
    val credential = accountRepository.credential()
      ?: return QueueDrainResult(completedJobs = 0, retryWorker = false)
    var completed = 0

    while (completed < maxJobs && elapsed() - startedAt < maxRunMillis) {
      if (isPaused()) return QueueDrainResult(completed, retryWorker = false)
      if (isStopped()) return QueueDrainResult(completed, retryWorker = true)

      val claimToken = newId()
      val claimedAt = now()
      val job = dao.claimNext(claimedAt, claimToken) ?: break
      val revision = dao.revision(job.revisionId)
      if (revision == null) {
        dao.blockClaim(job.id, claimToken, "local_missing", "local_missing")
        continue
      }

      val attemptId = newId()
      try {
        davClient.upload(
          credential,
          DavUploadRequest(
            localUri = revision.localUri,
            remotePathSegments = job.remotePathSegments,
            fileName = job.remoteFileName,
            byteCount = revision.byteCount,
            mimeType = mimeType(revision.localUri),
            modifiedAtEpochSeconds = revision.modifiedAt,
            createdAtEpochSeconds = null,
          ),
        )
        val finishedAt = now()
        dao.insertAttempt(UploadAttemptEntity(attemptId, job.id, claimedAt, finishedAt, "completed"))
        check(dao.completeClaim(job.id, claimToken, finishedAt) == 1)
        completed += 1
      } catch (error: Exception) {
        val failure = classifyTransferFailure(error)
        val finishedAt = now()
        dao.insertAttempt(
          UploadAttemptEntity(attemptId, job.id, claimedAt, finishedAt, failure.code),
        )
        if (failure.retryable) {
          dao.retryClaim(
            job.id,
            claimToken,
            finishedAt + retryDelayMillis(job.attemptCount),
            failure.code,
          )
          return QueueDrainResult(completed, retryWorker = true)
        }
        dao.blockClaim(job.id, claimToken, failure.code, failure.code)
      }
    }

    return QueueDrainResult(
      completedJobs = completed,
      retryWorker = dao.eligibleJobCount(now()) > 0,
    )
  }

  companion object {
    private val ABANDONED_AFTER_MILLIS = TimeUnit.MINUTES.toMillis(20)
    private const val DEFAULT_MAX_JOBS = 3
    private val DEFAULT_MAX_RUN_MILLIS = TimeUnit.MINUTES.toMillis(8)

    fun create(
      context: Context,
      isStopped: () -> Boolean = { false },
    ): QueueDrainRunner {
      val appContext = context.applicationContext
      val dao = EngineRoomDatabase.open(appContext).engineDao()
      return QueueDrainRunner(
        dao = dao,
        accountRepository = AndroidAccountRepository(appContext, dao),
        davClient = NextcloudUploadClient(AndroidLocalContentSource(appContext.contentResolver)),
        mimeType = { uri ->
          runCatching { appContext.contentResolver.getType(Uri.parse(uri)) }.getOrNull()
        },
        isPaused = EnginePreferences(appContext)::isPaused,
        isStopped = isStopped,
      )
    }
  }
}

data class TransferFailure(
  val code: String,
  val retryable: Boolean,
)

fun classifyTransferFailure(error: Exception): TransferFailure = when (error) {
  is AccountInvalidCredentialsException -> TransferFailure("invalid_credentials", false)
  is AccountCertificateException -> TransferFailure("certificate", false)
  is DavPermissionException -> TransferFailure("remote_permission", false)
  is DavNotFoundException -> TransferFailure("remote_missing", false)
  is DavInvalidPathException -> TransferFailure("invalid_path", false)
  is DavQuotaException -> TransferFailure("quota", false)
  is LocalContentMissingException -> TransferFailure("local_missing", false)
  is LocalContentInvalidException -> TransferFailure("local_invalid", false)
  is DavRateLimitedException -> TransferFailure("rate_limited", true)
  is DavLockedException -> TransferFailure("remote_locked", true)
  is AccountDnsException -> TransferFailure("dns", true)
  is AccountTimeoutException -> TransferFailure("timeout", true)
  is AccountConnectionRefusedException -> TransferFailure("connection_refused", true)
  is AccountServerException -> TransferFailure("server", true)
  is AccountNetworkException -> TransferFailure("network", true)
  else -> TransferFailure("unexpected", true)
}

fun retryDelayMillis(attemptCount: Int): Long {
  val exponent = (attemptCount - 1).coerceIn(0, 10)
  return (30_000L shl exponent).coerceAtMost(TimeUnit.HOURS.toMillis(6))
}
