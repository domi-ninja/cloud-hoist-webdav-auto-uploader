package ninja.domi.cloudhoist.engine

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class QueueDrainRunnerTest {
  private lateinit var database: EngineRoomDatabase
  private lateinit var dao: EngineDao
  private val uploaded = mutableListOf<DavUploadRequest>()
  private var clock = 1_000_000L

  @Before
  fun setUp() {
    database = Room.inMemoryDatabaseBuilder(
      ApplicationProvider.getApplicationContext<Context>(),
      EngineRoomDatabase::class.java,
    ).allowMainThreadQueries().build()
    dao = database.engineDao()
    dao.upsertAccount(account())
    dao.upsertSource(source())
  }

  @After
  fun tearDown() {
    database.close()
  }

  @Test
  fun boundedRunsUploadOldestFirstAndRequestContinuation() {
    enqueue("older", "revision-older", 10)
    enqueue("newer", "revision-newer", 20)
    val runner = runner(maxJobs = 1)

    val first = runner.run()

    assertEquals(1, first.completedJobs)
    assertTrue(first.retryWorker)
    assertTrue(first.continueImmediately)
    assertEquals("older.jpg", uploaded.single().fileName)
    assertEquals("older", uploaded.single().transferId)
    assertEquals("image/jpeg", uploaded.single().mimeType)
    assertEquals(99L, uploaded.single().createdAtEpochSeconds)
    assertEquals(JobState.COMPLETED, dao.job("older")?.state)
    assertEquals(JobState.QUEUED, dao.job("newer")?.state)

    val second = runner.run()
    assertEquals(1, second.completedJobs)
    assertFalse(second.retryWorker)
    assertEquals(listOf("older.jpg", "newer.jpg"), uploaded.map { it.fileName })
    assertEquals(1, dao.attemptCount("older"))
    assertEquals(1, dao.attemptCount("newer"))
  }

  @Test
  fun transientFailureReturnsTheClaimToRetryWait() {
    enqueue("job", "revision", 10)
    val runner = runner(
      davClient = DavClient { _, _ -> throw AccountTimeoutException() },
    )

    val result = runner.run()

    assertTrue(result.retryWorker)
    assertFalse(result.continueImmediately)
    assertEquals(JobState.RETRY_WAIT, dao.job("job")?.state)
    assertEquals("timeout", dao.job("job")?.lastErrorCode)
    assertEquals(clock + 30_000, dao.job("job")?.retryAt)
    assertEquals(1, dao.attemptCount("job"))
  }

  @Test
  fun futureRetryRemainsScheduledWhenNothingIsEligibleYet() {
    enqueue("job", "revision", 10)
    runner(davClient = DavClient { _, _ -> throw AccountTimeoutException() }).run()
    val waiting = runner().run()
    assertEquals(0, waiting.completedJobs)
    assertTrue(waiting.retryWorker)
    assertFalse(waiting.continueImmediately)
  }

  @Test
  fun userPauseDoesNotDelayTheUploadAfterResumeOrNotifyAboutFailure() {
    enqueue("paused", "revision-paused", 10, attemptCount = 5)
    var paused = false
    var interrupted = false
    val notices = mutableListOf<String>()
    val uploader = runner(
      isPaused = { paused },
      davClient = DavClient { _, request ->
        if (!interrupted) {
          interrupted = true
          paused = true
          assertTrue(request.isCancelled())
          throw TransferCancelledException()
        }
        DavUploadResult(false, false)
      },
      onFailure = { job, _ -> notices += job.id },
    )
    val result = uploader.run()

    assertFalse(result.retryWorker)
    assertEquals(clock, dao.job("paused")?.retryAt)
    assertEquals(1, dao.eligibleJobCount(clock))
    assertTrue(notices.isEmpty())
    paused = false
    assertEquals(1, uploader.run().completedJobs)
  }

  @Test
  fun processRecoveryRequeuesOnlyClaimsOwnedByTheDeadProcess() {
    enqueue("old", "old-revision", 10)
    enqueue("current", "current-revision", 20)
    dao.claimNext(clock, "old:claim")
    dao.claimNext(clock, "current:claim")
    assertEquals(1, dao.recoverForeignProcessClaims("current:%"))
    assertEquals(JobState.QUEUED, dao.job("old")?.state)
    assertEquals(JobState.RUNNING, dao.job("current")?.state)
  }

  @Test
  fun permanentFailureBlocksTheJobAndContinues() {
    enqueue("bad", "revision-bad", 10)
    enqueue("good", "revision-good", 20)
    val runner = runner(
      davClient = DavClient { _, request ->
        if (request.fileName == "bad.jpg") throw DavQuotaException()
        uploaded += request
        DavUploadResult(false, false)
      },
    )

    val result = runner.run()

    assertEquals(1, result.completedJobs)
    assertFalse(result.retryWorker)
    assertEquals(JobState.BLOCKED, dao.job("bad")?.state)
    assertEquals("quota", dao.job("bad")?.blockerCode)
    assertEquals(JobState.COMPLETED, dao.job("good")?.state)
  }

  @Test
  fun permanentFailureRequestsAnActionableNotification() {
    enqueue("blocked", "revision-blocked", 10)
    val notices = mutableListOf<Pair<String, TransferFailure>>()
    val runner = runner(
      davClient = DavClient { _, _ -> throw DavQuotaException() },
      onFailure = { job, failure -> notices += job.id to failure },
    )

    runner.run()

    assertEquals("blocked", notices.single().first)
    assertEquals(TransferFailure("quota", false, BlockerScope.JOB), notices.single().second)
  }

  @Test
  fun recordsOnlyClassifiedAttemptOutcomes() {
    enqueue("blocked", "revision-blocked", 10)
    enqueue("uploaded", "revision-uploaded", 20)
    val outcomes = mutableListOf<String>()
    val runner = runner(
      davClient = DavClient { _, request ->
        if (request.fileName == "blocked.jpg") throw DavQuotaException()
        DavUploadResult(false, false)
      },
      onAttemptFinished = outcomes::add,
    )

    runner.run()

    assertEquals(listOf("quota", "completed"), outcomes)
  }

  @Test
  fun thirdRetryableFailureRequestsAnActionableNotification() {
    enqueue("retrying", "revision-retrying", 10, attemptCount = 2)
    val notices = mutableListOf<Pair<String, TransferFailure>>()
    val runner = runner(
      davClient = DavClient { _, _ -> throw AccountTimeoutException() },
      onFailure = { job, failure -> notices += job.id to failure },
    )

    runner.run()

    assertEquals("retrying", notices.single().first)
    assertEquals(TransferFailure("timeout", true), notices.single().second)
  }

  @Test
  fun dayOldRetryableFailureRequestsAnActionableNotification() {
    clock = java.util.concurrent.TimeUnit.HOURS.toMillis(24) + 10
    enqueue("old", "revision-old", 10)
    val notices = mutableListOf<String>()
    val runner = runner(
      davClient = DavClient { _, _ -> throw AccountTimeoutException() },
      onFailure = { job, _ -> notices += job.id },
    )

    runner.run()

    assertEquals(listOf("old"), notices)
  }

  @Test
  fun freshFirstRetryableFailureStaysQuiet() {
    enqueue("fresh", "revision-fresh", 10)
    val notices = mutableListOf<String>()
    val runner = runner(
      davClient = DavClient { _, _ -> throw AccountTimeoutException() },
      onFailure = { job, _ -> notices += job.id },
    )

    runner.run()

    assertTrue(notices.isEmpty())
  }

  @Test
  fun credentialFailureBlocksTheAccountAndStopsNewClaims() {
    enqueue("bad", "revision-bad", 10)
    enqueue("waiting", "revision-waiting", 20)
    val runner = runner(
      davClient = DavClient { _, _ -> throw AccountInvalidCredentialsException() },
    )

    val result = runner.run()

    assertFalse(result.retryWorker)
    assertEquals("invalid_credentials", dao.account("account")?.blockerCode)
    assertEquals(JobState.BLOCKED, dao.job("bad")?.state)
    assertEquals(JobState.QUEUED, dao.job("waiting")?.state)
    assertEquals(null, dao.claimNext(clock, "another-worker"))
  }

  @Test
  fun missingContentBlocksItsSourceAndStopsNewClaims() {
    enqueue("missing", "revision-missing", 10)
    enqueue("waiting", "revision-waiting", 20)
    val runner = runner(
      davClient = DavClient { _, _ -> throw LocalContentMissingException() },
    )

    runner.run()

    assertEquals("local_missing", dao.source("source")?.blockerCode)
    assertEquals(JobState.BLOCKED, dao.job("missing")?.state)
    assertEquals(JobState.QUEUED, dao.job("waiting")?.state)
  }

  @Test
  fun givesChunkedClientFirstRefusalAndFallsBackToDirectUpload() {
    enqueue("large", "revision-large", 10)
    enqueue("small", "revision-small", 20)
    val chunkedJobs = mutableListOf<String>()
    val runner = runner(
      chunkedDavClient = ChunkedDavClient { _, jobId, request ->
        chunkedJobs += jobId
        if (request.fileName == "large.jpg") DavUploadResult(false, false) else null
      },
    )

    val result = runner.run()

    assertEquals(2, result.completedJobs)
    assertEquals(listOf("large", "small"), chunkedJobs)
    assertEquals(listOf("small.jpg"), uploaded.map { it.fileName })
  }

  @Test
  fun elapsedBudgetContinuesImmediatelyWithoutNetworkBackoff() {
    enqueue("large", "revision-large", 10)
    val elapsedValues = listOf(0L, 0L, 100L, 100L).iterator()
    val runner = runner(
      davClient = DavClient { _, request ->
        if (request.isCancelled()) throw TransferCancelledException()
        error("The elapsed budget should cancel this upload")
      },
      elapsed = elapsedValues::next,
      maxRunMillis = 100,
    )

    val result = runner.run()

    assertTrue(result.retryWorker)
    assertTrue(result.continueImmediately)
    assertEquals(JobState.RETRY_WAIT, dao.job("large")?.state)
    assertEquals(clock, dao.job("large")?.retryAt)
    assertEquals("cancelled", dao.job("large")?.lastErrorCode)
  }

  @Test
  fun reportsUploadProgressWithStableJobContext() {
    enqueue("job", "revision", 10)
    val progress = mutableListOf<TransferProgress>()
    val runner = runner(
      davClient = DavClient { _, request ->
        request.onProgress(7)
        DavUploadResult(false, false)
      },
      onProgress = progress::add,
    )

    runner.run()

    assertEquals(
      listOf(TransferProgress("job", "job.jpg", uploadedBytes = 7, totalBytes = 12)),
      progress,
    )
  }

  @Test
  fun stopsBeforeClaimingAnotherFileWhenConstraintsChange() {
    enqueue("first", "revision-first", 10)
    enqueue("second", "revision-second", 20)
    var allowed = true
    val runner = runner(
      davClient = DavClient { _, request ->
        uploaded += request
        allowed = false
        DavUploadResult(false, false)
      },
      canStartNextFile = { allowed },
    )

    val result = runner.run()

    assertEquals(1, result.completedJobs)
    assertTrue(result.retryWorker)
    assertEquals(JobState.COMPLETED, dao.job("first")?.state)
    assertEquals(JobState.QUEUED, dao.job("second")?.state)
  }

  private fun runner(
    maxJobs: Int = 3,
    davClient: DavClient = DavClient { _, request ->
      uploaded += request
      DavUploadResult(false, false)
    },
    chunkedDavClient: ChunkedDavClient? = null,
    elapsed: () -> Long = { 0 },
    maxRunMillis: Long = 8 * 60 * 1_000,
    onProgress: (TransferProgress) -> Unit = {},
    canStartNextFile: () -> Boolean = { true },
    onFailure: (UploadJobEntity, TransferFailure) -> Unit = { _, _ -> },
    onAttemptFinished: (String) -> Unit = {},
    isPaused: () -> Boolean = { false },
  ) = QueueDrainRunner(
    dao = dao,
    accountRepository = accountRepository(),
    davClient = davClient,
    chunkedDavClient = chunkedDavClient,
    mimeType = { "image/jpeg" },
    isPaused = isPaused,
    newId = generateSequence(0) { it + 1 }.iterator().let { ids ->
      { "generated-${ids.next()}" }
    },
    now = { clock },
    elapsed = elapsed,
    retryJitter = { 0.5 },
    maxJobs = maxJobs,
    maxRunMillis = maxRunMillis,
    onProgress = onProgress,
    canStartNextFile = canStartNextFile,
    onFailure = onFailure,
    onAttemptFinished = onAttemptFinished,
  )

  private fun enqueue(
    jobId: String,
    revisionId: String,
    createdAt: Long,
    attemptCount: Int = 0,
  ) {
    dao.enqueueRevision(
      LocalRevisionEntity(
        id = revisionId,
        sourceId = "source",
        providerId = revisionId,
        localUri = "content://fixture/$revisionId",
        relativePath = "$jobId.jpg",
        byteCount = 12,
        modifiedAt = 123,
        discoveredAt = 1,
        mimeType = "image/jpeg",
        createdAt = 99,
      ),
      UploadJobEntity(
        id = jobId,
        accountId = "account",
        sourceId = "source",
        revisionId = revisionId,
        remotePathSegments = listOf("Auto Upload"),
        remoteFileName = "$jobId.jpg",
        state = JobState.QUEUED,
        createdAt = createdAt,
        startedAt = null,
        completedAt = null,
        retryAt = null,
        attemptCount = attemptCount,
        claimToken = null,
        blockerCode = null,
        lastErrorCode = null,
      ),
    )
  }

  private fun account() = AccountEntity(
    id = "account",
    serverUrl = "https://cloud.example.test",
    loginName = "login",
    davUserId = "dav-user",
    displayName = "Domi",
    checkedAt = 1,
    serverVersion = "34.0.0",
    chunkingSupported = false,
    maxChunkSize = null,
    credentialReference = "android-keystore-v1",
  )

  private fun source() = SourceEntity(
    id = "source",
    accountId = "account",
    name = "Camera",
    kind = "media_store",
    localUri = "mediastore://camera",
    remotePathSegments = listOf("Auto Upload"),
    enabled = true,
    createdAt = 1,
    lastScanAt = null,
    blockerCode = null,
  )

  private fun accountRepository() = object : AccountRepository {
    override fun currentAccount() = credential.account
    override fun credential() = credential
    override fun save(credential: StoredAccountCredential) = Unit
    override fun clear() = Unit
  }

  private val credential = StoredAccountCredential(
    StoredAccount(
      id = "account",
      serverUrl = "https://cloud.example.test",
      loginName = "login",
      davUserId = "dav-user",
      displayName = "Domi",
      checkedAt = "2026-09-04T12:00:00Z",
      capabilities = AccountCapabilities("34.0.0", false, null),
    ),
    "secret",
  )
}
