package ninja.domi.webdavautoupload.engine

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoomEngineViewTest {
  private lateinit var database: EngineRoomDatabase
  private lateinit var dao: EngineDao

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
  fun snapshotReflectsRealQueueSourcesBlockersAndChunkProgress() {
    enqueue("queued", JobState.QUEUED, 10, 10)
    enqueue("running", JobState.RUNNING, 20, 25)
    enqueue("blocked", JobState.BLOCKED, 30, 30, error = "quota")
    enqueue("completed", JobState.COMPLETED, 40, 40, completedAt = 50)
    dao.upsertChunkCheckpoint(
      ChunkCheckpointEntity(
        uploadId = "upload",
        jobId = "running",
        chunkSize = 10,
        confirmedChunks = listOf("00001", "00002"),
        updatedAt = 30,
      ),
    )
    val view = RoomEngineView(dao, onInvalidated = {})

    val snapshot = view.snapshot(CONNECTED_ACCOUNT, SchedulerStatus())

    val queue = snapshot["queue"] as Map<*, *>
    assertEquals(1, queue["queued"])
    assertEquals(1, queue["uploading"])
    assertEquals(1, queue["failed"])
    assertEquals(1, queue["uploaded"])
    val sources = snapshot["sources"] as List<*>
    assertEquals("/Auto Upload/Camera", (sources.single() as Map<*, *>)["remotePath"])
    val worker = snapshot["worker"] as Map<*, *>
    assertEquals("uploading", worker["state"])
    assertEquals(20L, worker["bytesSent"])
    val blockers = snapshot["blockers"] as List<*>
    assertTrue(blockers.any { (it as Map<*, *>)["jobId"] == "blocked" })
    assertEquals("blocked", (snapshot["engine"] as Map<*, *>)["state"])
  }

  @Test
  fun activeUploadRemainsVisibleBehindThousandsOfNewerJobs() {
    enqueue("old-running", JobState.RUNNING, 1, 50)
    repeat(2000) { enqueue("queued-$it", JobState.QUEUED, it.toLong() + 2, 10) }
    val snapshot = RoomEngineView(dao, onInvalidated = {}).snapshot(CONNECTED_ACCOUNT, SchedulerStatus())
    assertEquals("old-running", (snapshot["worker"] as Map<*, *>)["jobId"])
    val source = (snapshot["sources"] as List<*>).single() as Map<*, *>
    assertEquals(2001, (source["queue"] as Map<*, *>)["pending"])
    assertEquals(100, (snapshot["recentJobs"] as List<*>).size)
  }

  @Test
  fun retryResetAndRemoveMutateTheWorkerDatabase() {
    enqueue("blocked", JobState.BLOCKED, 10, 30, error = "quota")
    dao.upsertChunkCheckpoint(
      ChunkCheckpointEntity("upload", "blocked", 10, listOf("00001"), 20),
    )
    val invalidations = mutableListOf<Int>()
    val view = RoomEngineView(dao, invalidations::add)

    assertEquals(1, view.retryFailed())
    assertEquals(JobState.QUEUED, dao.job("blocked")?.state)
    view.resetSourceHistory("source")
    assertEquals(0, dao.revisionCount())
    assertNull(dao.chunkCheckpoint("blocked"))
    view.removeSource("source")
    assertEquals(0, dao.sourceCount("source"))
    assertEquals(listOf(2, 3, 4), invalidations)
  }

  @Test
  fun clearHistoryDeletesOnlyCompletedJobs() {
    enqueue("completed", JobState.COMPLETED, 10, 20, completedAt = 30)
    enqueue("queued", JobState.QUEUED, 20, 20)
    enqueue("blocked", JobState.BLOCKED, 30, 20, error = "quota")
    val invalidations = mutableListOf<Int>()
    val view = RoomEngineView(dao, invalidations::add)

    assertEquals(1, view.clearCompletedHistory())

    assertNull(dao.job("completed"))
    assertEquals(JobState.QUEUED, dao.job("queued")?.state)
    assertEquals(JobState.BLOCKED, dao.job("blocked")?.state)
    assertEquals(listOf(2), invalidations)
  }

  @Test
  fun scanningWorkerReportsItsScopeInsteadOfAFakeSourceId() {
    val view = RoomEngineView(dao, onInvalidated = {})

    val snapshot = view.snapshot(
      CONNECTED_ACCOUNT,
      SchedulerStatus(
        lastScanRequestedAt = "2026-09-04T12:00:00Z",
        workerState = "scanning",
        workerScope = "media",
      ),
    )

    val worker = snapshot["worker"] as Map<*, *>
    assertEquals("scanning", worker["state"])
    assertEquals("media", worker["scope"])
    assertFalse(worker.containsKey("sourceId"))
  }

  @Test
  fun queuedWorkReportsWhyItCannotStart() {
    enqueue("queued", JobState.QUEUED, 10, 10)
    val view = RoomEngineView(dao, onInvalidated = {})

    val snapshot = view.snapshot(
      CONNECTED_ACCOUNT,
      SchedulerStatus(),
      waitingReason = "Waiting for charging",
    )

    val worker = snapshot["worker"] as Map<*, *>
    assertEquals("waiting", worker["state"])
    assertEquals("Waiting for charging", worker["reason"])
  }

  @Test
  fun activityPagesExcludeEntriesOlderThanThirtyDays() {
    val day = TimeUnit.DAYS.toMillis(1)
    enqueue("activity", JobState.COMPLETED, 35 * day, 20, completedAt = 39 * day)
    dao.insertAttempt(UploadAttemptEntity("newest", "activity", 39 * day, 39 * day, "completed"))
    dao.insertAttempt(UploadAttemptEntity("older", "activity", 38 * day, 38 * day, "timeout"))
    dao.insertAttempt(UploadAttemptEntity("expired", "activity", day, day, "completed"))
    val view = RoomEngineView(dao, onInvalidated = {}, now = { 40 * day })

    val first = view.activityPage(offset = 0, pageSize = 1)
    val second = view.activityPage(offset = 1, pageSize = 1)

    assertEquals("newest", ((first["items"] as List<*>).single() as Map<*, *>)["id"])
    assertEquals(1, first["nextOffset"])
    assertEquals("older", ((second["items"] as List<*>).single() as Map<*, *>)["id"])
    assertNull(second["nextOffset"])
  }

  private fun enqueue(
    id: String,
    state: String,
    createdAt: Long,
    byteCount: Long,
    error: String? = null,
    completedAt: Long? = null,
  ) {
    val revisionId = "revision-$id"
    dao.enqueueRevision(
      LocalRevisionEntity(
        id = revisionId,
        sourceId = "source",
        providerId = revisionId,
        localUri = "content://fixture/$id",
        relativePath = "$id.jpg",
        byteCount = byteCount,
        modifiedAt = 1,
        discoveredAt = createdAt,
        mimeType = "image/jpeg",
      ),
      UploadJobEntity(
        id = id,
        accountId = "account",
        sourceId = "source",
        revisionId = revisionId,
        remotePathSegments = listOf("Auto Upload", "Camera"),
        remoteFileName = "$id.jpg",
        state = state,
        createdAt = createdAt,
        startedAt = if (state == JobState.RUNNING) createdAt else null,
        completedAt = completedAt,
        retryAt = null,
        attemptCount = 1,
        claimToken = if (state == JobState.RUNNING) "worker" else null,
        blockerCode = error,
        lastErrorCode = error,
      ),
    )
  }

  private fun account() = AccountEntity(
    id = "account",
    serverUrl = "https://cloud.example.test",
    loginName = "domi",
    davUserId = "domi",
    displayName = "Domi",
    checkedAt = 1,
    serverVersion = "34",
    chunkingSupported = true,
    maxChunkSize = null,
    credentialReference = "key",
  )

  private fun source() = SourceEntity(
    id = "source",
    accountId = "account",
    name = "Camera",
    kind = "media_store",
    localUri = "mediastore://camera",
    remotePathSegments = listOf("Auto Upload", "Camera"),
    enabled = true,
    createdAt = 1,
    lastScanAt = 2,
    blockerCode = null,
  )

  private companion object {
    val CONNECTED_ACCOUNT = mapOf<String, Any?>("status" to "connected")
  }
}
