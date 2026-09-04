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
  private val chunkedDavClient: ChunkedDavClient? = null,
  private val mimeType: (String) -> String?,
  private val isPaused: () -> Boolean,
  private val isStopped: () -> Boolean = { false },
  private val newId: () -> String = { UUID.randomUUID().toString() },
  private val now: () -> Long = System::currentTimeMillis,
  private val elapsed: () -> Long = android.os.SystemClock::elapsedRealtime,
  private val retryJitter: () -> Double = Math::random,
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
        val request = DavUploadRequest(
          localUri = revision.localUri,
          remotePathSegments = job.remotePathSegments,
          fileName = job.remoteFileName,
          byteCount = revision.byteCount,
          mimeType = revision.mimeType ?: mimeType(revision.localUri),
          modifiedAtEpochSeconds = revision.modifiedAt,
          createdAtEpochSeconds = revision.createdAt,
          isCancelled = {
            isPaused() || isStopped() || elapsed() - startedAt >= maxRunMillis
          },
        )
        chunkedDavClient?.upload(credential, job.id, request)
          ?: davClient.upload(credential, request)
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
            finishedAt + retryDelayMillis(
              job.attemptCount,
              retryJitter(),
              failure.retryAfterMillis,
            ),
            failure.code,
          )
          return QueueDrainResult(completed, retryWorker = true)
        }
        when (failure.scope) {
          BlockerScope.ACCOUNT -> dao.blockAccountClaim(
            job.id,
            claimToken,
            job.accountId,
            failure.code,
            failure.code,
          )
          BlockerScope.SOURCE -> dao.blockSourceClaim(
            job.id,
            claimToken,
            job.sourceId,
            failure.code,
            failure.code,
          )
          BlockerScope.JOB, null -> dao.blockClaim(
            job.id,
            claimToken,
            failure.code,
            failure.code,
          )
        }
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
      val contentSource = AndroidLocalContentSource(appContext.contentResolver)
      return QueueDrainRunner(
        dao = dao,
        accountRepository = AndroidAccountRepository(appContext, dao),
        davClient = NextcloudUploadClient(contentSource),
        chunkedDavClient = NextcloudChunkUploadClient(
          checkpoints = RoomChunkCheckpointStore(dao),
          transport = NextcloudChunkTransport(contentSource),
        ),
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
  val scope: BlockerScope? = null,
  val retryAfterMillis: Long? = null,
)

enum class BlockerScope { ACCOUNT, SOURCE, JOB }

fun classifyTransferFailure(error: Exception): TransferFailure = when (error) {
  is AccountInvalidCredentialsException ->
    TransferFailure("invalid_credentials", false, BlockerScope.ACCOUNT)
  is AccountCertificateException -> TransferFailure("certificate", false, BlockerScope.ACCOUNT)
  is DavPermissionException -> TransferFailure("remote_permission", false, BlockerScope.SOURCE)
  is DavNotFoundException -> TransferFailure("remote_missing", false, BlockerScope.SOURCE)
  is DavInvalidPathException -> TransferFailure("invalid_path", false, BlockerScope.JOB)
  is DavQuotaException -> TransferFailure("quota", false, BlockerScope.JOB)
  is LocalContentMissingException -> TransferFailure("local_missing", false, BlockerScope.SOURCE)
  is LocalContentInvalidException -> TransferFailure("local_invalid", false, BlockerScope.JOB)
  is TransferCancelledException -> TransferFailure("cancelled", true)
  is DavRateLimitedException -> TransferFailure(
    "rate_limited",
    true,
    retryAfterMillis = error.retryAfterMillis,
  )
  is DavLockedException -> TransferFailure("remote_locked", true)
  is AccountDnsException -> TransferFailure("dns", true)
  is AccountTimeoutException -> TransferFailure("timeout", true)
  is AccountConnectionRefusedException -> TransferFailure("connection_refused", true)
  is AccountServerException -> TransferFailure("server", true)
  is AccountNetworkException -> TransferFailure("network", true)
  else -> TransferFailure("unexpected", true)
}

fun retryDelayMillis(
  attemptCount: Int,
  jitter: Double,
  serverDelayMillis: Long? = null,
): Long {
  val cap = TimeUnit.HOURS.toMillis(6)
  val exponent = (attemptCount - 1).coerceIn(0, 10)
  val base = (30_000L shl exponent).coerceAtMost(cap)
  val factor = 0.9 + jitter.coerceIn(0.0, 1.0) * 0.2
  val jittered = (base * factor).toLong().coerceIn(30_000L, cap)
  return maxOf(jittered, serverDelayMillis?.coerceAtMost(cap) ?: 0L)
}
