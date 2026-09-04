package ninja.domi.webdavautoupload.engine

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EngineDaoTest {
  private lateinit var database: EngineRoomDatabase
  private lateinit var dao: EngineDao

  @Before
  fun openDatabase() {
    database = Room.inMemoryDatabaseBuilder(
      ApplicationProvider.getApplicationContext<Context>(),
      EngineRoomDatabase::class.java,
    ).allowMainThreadQueries().build()
    dao = database.engineDao()
    dao.upsertAccount(account())
    dao.upsertSource(source())
  }

  @After
  fun closeDatabase() {
    database.close()
  }

  @Test
  fun discoveryDeduplicatesExactRevisionsButQueuesChangesAndMoves() {
    assertTrue(dao.enqueueRevision(revision("r1"), job("j1", "r1", 1)))
    assertFalse(dao.enqueueRevision(revision("duplicate"), job("duplicate", "duplicate", 2)))
    assertTrue(
      dao.enqueueRevision(
        revision("r2", byteCount = 11),
        job("j2", "r2", 3),
      ),
    )
    assertTrue(
      dao.enqueueRevision(
        revision("r3", relativePath = "moved/photo.jpg"),
        job("j3", "r3", 4),
      ),
    )
  }

  @Test
  fun claimsOldestEligibleJobOnlyOnceAndChecksTheTokenOnCompletion() {
    dao.enqueueRevision(revision("r2", providerId = "p2"), job("newer", "r2", 20))
    dao.enqueueRevision(revision("r1"), job("older", "r1", 10))

    val claim = dao.claimNext(100, "worker-a")

    assertEquals("older", claim?.id)
    assertEquals(JobState.RUNNING, claim?.state)
    assertEquals(1, claim?.attemptCount)
    assertEquals(0, dao.completeClaim("older", "wrong-worker", 110))
    assertEquals(1, dao.completeClaim("older", "worker-a", 110))
    assertEquals(JobState.COMPLETED, dao.job("older")?.state)
  }

  @Test
  fun recoversAbandonedWorkAndHonorsRetryTime() {
    dao.enqueueRevision(revision("r1"), job("j1", "r1", 1))
    val firstClaim = dao.claimNext(100, "worker-a")
    assertNotNull(firstClaim)
    assertEquals(0, dao.recoverAbandoned(99))
    assertEquals(1, dao.recoverAbandoned(101))
    val recovered = dao.claimNext(102, "worker-b")
    assertEquals("j1", recovered?.id)
    assertEquals(1, dao.retryClaim("j1", "worker-b", 200, "timeout"))
    assertNull(dao.claimNext(199, "worker-c"))
    assertNotNull(dao.claimNext(200, "worker-d"))
  }

  @Test
  fun cleanupAndSourceRemovalLeaveUnfinishedAndOtherSourcesAlone() {
    dao.enqueueRevision(revision("old"), job("old", "old", 1))
    val claim = dao.claimNext(2, "worker")!!
    dao.completeClaim(claim.id, "worker", 10)
    dao.enqueueRevision(revision("queued", providerId = "p2"), job("queued", "queued", 2))

    assertEquals(1, dao.deleteCompletedBefore(11))
    assertNotNull(dao.job("queued"))
    assertTrue(dao.removeSource("source-1"))
    assertEquals(0, dao.sourceCount("source-1"))
    assertNull(dao.job("queued"))
  }

  @Test
  fun competingClaimsReturnOneJobToOneWorker() {
    dao.enqueueRevision(revision("r1"), job("j1", "r1", 1))
    val start = CountDownLatch(1)
    val finished = CountDownLatch(8)
    val executor = Executors.newFixedThreadPool(8)
    val claims = java.util.Collections.synchronizedList(mutableListOf<UploadJobEntity>())
    repeat(8) { index ->
      executor.execute {
        start.await()
        dao.claimNext(10, "worker-$index")?.let(claims::add)
        finished.countDown()
      }
    }

    start.countDown()
    assertTrue(finished.await(10, TimeUnit.SECONDS))
    executor.shutdownNow()
    assertEquals(listOf("j1"), claims.map(UploadJobEntity::id))
  }

  @Test
  fun completedRevisionDoesNotRequeueAfterHistoryCleanup() {
    val revision = revision("r1")
    dao.enqueueRevision(revision, job("j1", "r1", 1))
    dao.claimNext(2, "worker")
    dao.completeClaim("j1", "worker", 3)
    dao.deleteCompletedBefore(4)

    assertFalse(dao.enqueueRevision(revision.copy(id = "duplicate"), job("j2", "duplicate", 5)))
    assertEquals(1, dao.revisionCount())
    assertEquals(0, dao.jobCount())
  }

  @Test
  fun fileBackedDatabaseSurvivesReopenAndWipeCascadesEverything() {
    database.close()
    val context = ApplicationProvider.getApplicationContext<Context>()
    val name = "engine-reopen-test.db"
    context.deleteDatabase(name)
    database = Room.databaseBuilder(context, EngineRoomDatabase::class.java, name)
      .allowMainThreadQueries()
      .build()
    dao = database.engineDao()
    dao.upsertAccount(account())
    dao.upsertSource(source())
    dao.enqueueRevision(revision("r1"), job("j1", "r1", 1))
    database.close()

    database = Room.databaseBuilder(context, EngineRoomDatabase::class.java, name)
      .allowMainThreadQueries()
      .build()
    dao = database.engineDao()
    assertEquals(1, dao.accountCount())
    assertEquals(1, dao.jobCount())
    dao.wipe()
    assertEquals(0, dao.accountCount())
    assertEquals(0, dao.sourceCount("source-1"))
    assertEquals(0, dao.revisionCount())
    assertEquals(0, dao.jobCount())
    database.close()
    context.deleteDatabase(name)
  }

  @Test
  fun parentUpsertsPreserveTheQueue() {
    dao.enqueueRevision(revision("r1"), job("j1", "r1", 1))

    dao.upsertAccount(account().copy(displayName = "Changed"))
    dao.upsertSource(source().copy(name = "Renamed", enabled = false))

    assertEquals(1, dao.sourceCount("source-1"))
    assertEquals(1, dao.revisionCount())
    assertEquals(1, dao.jobCount())
  }

  private fun account() = AccountEntity(
    id = "account-1",
    serverUrl = "https://cloud.example.test",
    loginName = "login",
    davUserId = "dav-user",
    displayName = "Domi",
    checkedAt = 1,
    serverVersion = "34.0.0",
    chunkingSupported = true,
    maxChunkSize = null,
    credentialReference = "android-keystore-v1",
  )

  private fun source() = SourceEntity(
    id = "source-1",
    accountId = "account-1",
    name = "Camera",
    kind = "media_store",
    localUri = "content://media/external/images",
    remotePathSegments = listOf("Auto Upload", "Camera"),
    enabled = true,
    createdAt = 1,
    lastScanAt = null,
    blockerCode = null,
  )

  private fun revision(
    id: String,
    providerId: String = "provider-1",
    relativePath: String = "photo.jpg",
    byteCount: Long = 10,
  ) = LocalRevisionEntity(
    id = id,
    sourceId = "source-1",
    providerId = providerId,
    localUri = "content://fixture/$id",
    relativePath = relativePath,
    byteCount = byteCount,
    modifiedAt = 100,
    discoveredAt = 1,
  )

  private fun job(id: String, revisionId: String, createdAt: Long) = UploadJobEntity(
    id = id,
    sourceId = "source-1",
    revisionId = revisionId,
    remotePathSegments = listOf("Auto Upload", "Camera"),
    remoteFileName = "photo.jpg",
    state = JobState.QUEUED,
    createdAt = createdAt,
    startedAt = null,
    completedAt = null,
    retryAt = null,
    attemptCount = 0,
    claimToken = null,
    blockerCode = null,
    lastErrorCode = null,
  )
}
