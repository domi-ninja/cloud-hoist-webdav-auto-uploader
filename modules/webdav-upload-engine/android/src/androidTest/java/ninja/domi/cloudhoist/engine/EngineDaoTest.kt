package ninja.domi.cloudhoist.engine

import android.content.Context
import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
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
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EngineDaoTest {
  @get:Rule
  val migrationHelper = MigrationTestHelper(
    InstrumentationRegistry.getInstrumentation(),
    EngineRoomDatabase::class.java.canonicalName,
    FrameworkSQLiteOpenHelperFactory(),
  )

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
  fun queueTotalsExcludeEveryStateInDisabledFolders() {
    dao.upsertSource(source().copy(id = "disabled", enabled = false))
    for ((index, state) in listOf(JobState.QUEUED, JobState.RUNNING, JobState.BLOCKED, JobState.COMPLETED).withIndex()) {
      val id = "disabled-$index"
      dao.enqueueRevision(revision(id).copy(sourceId = "disabled", providerId = id),
        job(id, id, index.toLong()).copy(sourceId = "disabled", state = state))
    }
    dao.enqueueRevision(revision("active"), job("active", "active", 100).copy(state = JobState.COMPLETED))
    assertEquals(QueueCounts(0, 0, 0, 1), dao.queueCounts())
    assertEquals(0L, dao.remainingUploadBytes())
    assertEquals(2, dao.sourceQueueCounts().single { it.sourceId == "disabled" }.pending)
    dao.upsertSource(source().copy(id = "disabled", enabled = true))
    assertEquals(QueueCounts(1, 1, 1, 2), dao.queueCounts())
    dao.upsertSource(source().copy(enabled = false))
    dao.upsertSource(source().copy(id = "disabled", enabled = false))
    assertEquals(QueueCounts(0, 0, 0, 0), dao.queueCounts())
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

  @Test
  fun storesManyIndependentSourcesWithoutTruncatingOrReplacing() {
    assertTrue(dao.removeSource("source-1"))
    val expectedIds = List(256) { index -> "folder-${index.toString().padStart(3, '0')}" }

    expectedIds.forEachIndexed { index, id ->
      dao.upsertSource(
        source().copy(
          id = id,
          name = "Folder $index",
          kind = "saf",
          localUri = "content://documents/tree/$index",
          createdAt = index.toLong(),
        ),
      )
    }

    val stored = dao.allSources()
    assertEquals(256, stored.size)
    assertEquals(expectedIds, stored.map(SourceEntity::id))
    assertEquals(256, stored.map(SourceEntity::localUri).distinct().size)
  }

  @Test
  fun disabledAndBlockedSourcesCannotFeedClaims() {
    dao.enqueueRevision(revision("r1"), job("j1", "r1", 1))
    dao.upsertSource(source().copy(enabled = false))
    assertNull(dao.claimNext(2, "disabled-worker"))

    dao.upsertSource(source().copy(blockerCode = "permission_revoked"))
    assertNull(dao.claimNext(3, "blocked-worker"))

    dao.upsertSource(source())
    assertEquals("j1", dao.claimNext(4, "enabled-worker")?.id)
  }

  @Test
  fun blockedAccountsCannotFeedClaims() {
    dao.enqueueRevision(revision("r1"), job("j1", "r1", 1))
    dao.upsertAccount(account().copy(blockerCode = "invalid_credentials"))

    assertNull(dao.claimNext(2, "blocked-worker"))

    dao.upsertAccount(account())
    assertEquals("j1", dao.claimNext(3, "enabled-worker")?.id)
  }

  @Test
  fun migrationOneToTwoBackfillsAccountIdAndPreservesChildren() {
    val name = "engine-migration-test.db"
    migrationHelper.createDatabase(name, 1).apply {
      execSQL(
        "INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("account-1", "https://cloud.test", "login", "dav", "Domi", 1, "34", 1, null, "key"),
      )
      execSQL(
        "INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("source-1", "account-1", "Camera", "media_store", "content://media", "[]", 1, 1, null, null),
      )
      execSQL(
        "INSERT INTO local_revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("revision-1", "source-1", "provider", "content://photo", "photo.jpg", 10, 1, 1),
      )
      execSQL(
        "INSERT INTO upload_jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("job-1", "source-1", "revision-1", "[]", "photo.jpg", "queued", 1, null, null, null, 0, null, null, null),
      )
      execSQL(
        "INSERT INTO upload_attempts VALUES (?, ?, ?, ?, ?)",
        arrayOf("attempt-1", "job-1", 1, null, null),
      )
      execSQL(
        "INSERT INTO chunk_checkpoints VALUES (?, ?, ?, ?, ?)",
        arrayOf("upload-1", "job-1", 10, "[]", 1),
      )
      close()
    }

    migrationHelper.runMigrationsAndValidate(
      name,
      2,
      true,
      EngineRoomDatabase.MIGRATION_1_2,
    ).use { migrated ->
      migrated.query("SELECT accountId FROM upload_jobs WHERE id = 'job-1'").use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertEquals("account-1", cursor.getString(0))
      }
      migrated.query("SELECT COUNT(*) FROM upload_attempts").use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertEquals(1, cursor.getInt(0))
      }
      migrated.query("SELECT COUNT(*) FROM chunk_checkpoints").use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertEquals(1, cursor.getInt(0))
      }
    }
  }

  @Test
  fun migrationTwoToThreeAddsAnEmptyAccountBlocker() {
    val name = "engine-migration-two-three.db"
    migrationHelper.createDatabase(name, 2).apply {
      execSQL(
        "INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("account-1", "https://cloud.test", "login", "dav", "Domi", 1, "34", 1, null, "key"),
      )
      close()
    }

    migrationHelper.runMigrationsAndValidate(
      name,
      3,
      true,
      EngineRoomDatabase.MIGRATION_2_3,
    ).use { migrated ->
      migrated.query("SELECT blockerCode FROM accounts WHERE id = 'account-1'").use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertTrue(cursor.isNull(0))
      }
    }
  }

  @Test
  fun migrationThreeToFourAddsNullableContentMetadata() {
    val name = "engine-migration-three-four.db"
    migrationHelper.createDatabase(name, 3).apply {
      execSQL(
        "INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("account-1", "https://cloud.test", "login", "dav", "Domi", 1, "34", 1, null, "key", null),
      )
      execSQL(
        "INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("source-1", "account-1", "Camera", "media_store", "content://media", "[]", 1, 1, null, null),
      )
      execSQL(
        "INSERT INTO local_revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("revision-1", "source-1", "provider", "content://photo", "photo.jpg", 10, 1, 1),
      )
      close()
    }

    migrationHelper.runMigrationsAndValidate(
      name,
      4,
      true,
      EngineRoomDatabase.MIGRATION_3_4,
    ).use { migrated ->
      migrated.query(
        "SELECT mimeType, createdAt FROM local_revisions WHERE id = 'revision-1'",
      ).use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertTrue(cursor.isNull(0))
        assertTrue(cursor.isNull(1))
      }
    }
  }

  @Test
  fun migrationFourToFiveDefaultsExistingSourcesToReplace() {
    val name = "engine-migration-four-five.db"
    migrationHelper.createDatabase(name, 4).apply {
      execSQL(
        "INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("account-1", "https://cloud.test", "login", "dav", "Domi", 1, "34", 1, null, "key", null),
      )
      execSQL(
        "INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("source-1", "account-1", "Camera", "media_store", "content://media", "[]", 1, 1, null, null),
      )
      close()
    }

    migrationHelper.runMigrationsAndValidate(
      name,
      5,
      true,
      EngineRoomDatabase.MIGRATION_4_5,
    ).use { migrated ->
      migrated.query("SELECT collisionPolicy FROM sources WHERE id = 'source-1'").use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertEquals("replace", cursor.getString(0))
      }
    }
  }

  @Test
  fun migrationFiveToSixMarksExistingRevisionsAsSeen() {
    val name = "engine-migration-five-six.db"
    migrationHelper.createDatabase(name, 5).apply {
      execSQL(
        "INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("account-1", "https://cloud.test", "login", "dav", "Domi", 1, "34", 1, null, "key", null),
      )
      execSQL(
        "INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("source-1", "account-1", "Camera", "media_store", "content://media", "[]", 1, 1, 100, null, "replace"),
      )
      execSQL(
        "INSERT INTO local_revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf("revision-1", "source-1", "provider", "content://photo", "photo.jpg", 10, 1, 100, "image/jpeg", 1),
      )
      close()
    }

    migrationHelper.runMigrationsAndValidate(
      name,
      6,
      true,
      EngineRoomDatabase.MIGRATION_5_6,
    ).use { migrated ->
      migrated.query("SELECT lastSeenAt FROM local_revisions WHERE id = 'revision-1'").use { cursor ->
        assertTrue(cursor.moveToFirst())
        assertEquals(100L, cursor.getLong(0))
      }
    }
  }

  @Test
  fun blockerAttemptAndChunkCheckpointRemainAttachedToTheJob() {
    dao.enqueueRevision(revision("r1"), job("j1", "r1", 1))
    dao.claimNext(2, "worker")
    dao.insertAttempt(
      UploadAttemptEntity(
        id = "attempt-1",
        jobId = "j1",
        startedAt = 2,
        finishedAt = 3,
        resultCode = "quota",
      ),
    )
    dao.upsertChunkCheckpoint(
      ChunkCheckpointEntity(
        uploadId = "upload-1",
        jobId = "j1",
        chunkSize = 10,
        confirmedChunks = listOf("0000000000000001"),
        updatedAt = 3,
      ),
    )

    assertEquals(1, dao.blockClaim("j1", "worker", "quota", "dav_quota"))
    assertEquals(JobState.BLOCKED, dao.job("j1")?.state)
    assertEquals("quota", dao.job("j1")?.blockerCode)
    assertEquals(1, dao.attemptCount("j1"))
    assertEquals(
      listOf("0000000000000001"),
      dao.chunkCheckpoint("j1")?.confirmedChunks,
    )
    val session = dao.chunkSessions().single()
    assertEquals("upload-1", session.uploadId)
    assertEquals("content://fixture/r1", session.localUri)
    assertEquals(listOf("Auto Upload", "Camera"), session.remotePathSegments)
    assertEquals("photo.jpg", session.remoteFileName)
    assertEquals(1, dao.deleteChunkCheckpoint("j1"))
    assertEquals(null, dao.chunkCheckpoint("j1"))
  }

  @Test
  fun newFilesOnlyBaselinesExistingRevisionsThenQueuesChanges() {
    var nextId = 0
    val recorder = SourceRevisionRecorder(
      dao,
      newId = { "generated-${nextId++}" },
      now = { 10_000 },
    )
    val initial = discoveredFile("provider-1", "photo.jpg", size = 10, modified = 100)

    val baseline = recorder.record(source(), listOf(initial), queueNewRevisions = false)
    val unchanged = recorder.record(source(), listOf(initial), queueNewRevisions = true)
    val modified = recorder.record(
      source(),
      listOf(initial.copy(byteCount = 11)),
      queueNewRevisions = true,
    )

    assertEquals(1, baseline.revisionsAdded)
    assertEquals(0, baseline.jobsAdded)
    assertEquals(0, unchanged.revisionsAdded)
    assertEquals(0, unchanged.jobsAdded)
    assertEquals(1, modified.revisionsAdded)
    assertEquals(1, modified.jobsAdded)
    assertEquals(2, dao.revisionCount())
    assertEquals(1, dao.jobCount())
  }

  @Test
  fun discoveryQueuesOldestFirstAndKeepsSelectedTreeFolders() {
    var nextId = 0
    val recorder = SourceRevisionRecorder(
      dao,
      newId = { "generated-${nextId++}" },
      now = { 10_000 },
    )
    val newer = discoveredFile(
      providerId = "newer",
      name = "same.jpg",
      size = 20,
      modified = 200,
      relativePath = listOf("Trips", "2026"),
    )
    val older = discoveredFile(
      providerId = "older",
      name = "same.jpg",
      size = 10,
      modified = 100,
      relativePath = listOf("Archive"),
    )

    val result = recorder.record(source(), listOf(newer, older), queueNewRevisions = true)
    val first = dao.claimNext(300_000, "worker")

    assertEquals(2, result.preview.eligibleFileCount)
    assertEquals(30L, result.preview.totalBytes)
    assertEquals(2, result.preview.files.size)
    assertEquals(2, result.jobsAdded)
    assertEquals("same.jpg", first?.remoteFileName)
    assertEquals(
      listOf("Auto Upload", "Camera", "Archive"),
      first?.remotePathSegments,
    )
  }

  @Test
  fun localInventoryOnlyIncludesFilesSeenByTheLatestScan() {
    var scannedAt = 100L
    var nextId = 0
    val recorder = SourceRevisionRecorder(
      dao,
      newId = { "inventory-${nextId++}" },
      now = { scannedAt },
    )
    val first = discoveredFile("first", "first.jpg", 10, 1)
    val missing = discoveredFile("missing", "missing.jpg", 10, 1)

    recorder.record(source(), listOf(first, missing), queueNewRevisions = true)
    scannedAt = 200L
    recorder.record(source(), listOf(first), queueNewRevisions = true)

    assertEquals(listOf("first.jpg"), dao.localInventory().map(LocalInventoryView::localRelativePath))
  }

  @Test
  fun sourceManagerQueuesExistingFilesOnFirstCommit() {
    var nextId = 0
    val discovered = discoveredFile("provider", "photo.jpg", 50, 100)
    val manager = SourceDiscoveryManager(
      accountRepository = storedAccountRepository(),
      recorder = SourceRevisionRecorder(
        dao,
        newId = { "record-${nextId++}" },
        now = { 20_000 },
      ),
      mediaDiscovery = MediaPresetDiscovery {
        MediaDiscovery(listOf(discovered), MediaPermissionAccess.PARTIAL)
      },
      documentTreeDiscovery = DocumentTreeSourceDiscovery { emptyList() },
      newId = { "created-source" },
      now = { 20_000 },
    )

    val result = manager.commit(
      SourceCommit(
        name = "  Screenshots  ",
        selection = SourceSelection(SourceType.SCREENSHOTS),
        remotePathSegments = listOf("Auto Upload", "Screenshots"),
        collisionPolicy = CollisionPolicy.REPLACE,
      ),
    )

    assertEquals("created-source", result.sourceId)
    assertEquals(1, result.preview.eligibleFileCount)
    assertEquals(50L, result.preview.totalBytes)
    assertEquals(MediaPermissionAccess.PARTIAL, result.preview.permissionAccess)
    assertEquals(listOf(discovered.localUri), result.preview.files.map { it.localUri })
    assertEquals(1, result.jobsAdded)
    assertEquals(1, dao.sourceCount("created-source"))
  }

  @Test
  fun sourceManagerRefusesMediaWithoutRuntimeAccess() {
    val manager = SourceDiscoveryManager(
      accountRepository = storedAccountRepository(),
      recorder = SourceRevisionRecorder(dao),
      mediaDiscovery = MediaPresetDiscovery {
        MediaDiscovery(emptyList(), MediaPermissionAccess.DENIED)
      },
      documentTreeDiscovery = DocumentTreeSourceDiscovery { emptyList() },
    )

    val error = org.junit.Assert.assertThrows(SourceAccessException::class.java) {
      manager.preview(SourceSelection(SourceType.CAMERA))
    }

    assertEquals(SourceAccessBlocker.PERMISSION_REVOKED, error.blocker)
  }

  @Test
  fun failedRescanBlocksSourceWithoutDeletingItsQueue() {
    dao.enqueueRevision(revision("r1"), job("j1", "r1", 1))
    dao.upsertSource(source().copy(localUri = "mediastore://camera"))
    val manager = SourceDiscoveryManager(
      accountRepository = storedAccountRepository(),
      recorder = SourceRevisionRecorder(dao, now = { 30_000 }),
      mediaDiscovery = MediaPresetDiscovery {
        MediaDiscovery(emptyList(), MediaPermissionAccess.DENIED)
      },
      documentTreeDiscovery = DocumentTreeSourceDiscovery { emptyList() },
    )

    val result = manager.scan("source-1")

    assertEquals(SourceAccessBlocker.PERMISSION_REVOKED, result.blocker)
    assertEquals("permission_revoked", dao.source("source-1")?.blockerCode)
    assertEquals(30_000L, dao.source("source-1")?.lastScanAt)
    assertEquals(1, dao.jobCount())
    assertNull(dao.claimNext(30_001, "worker"))
  }

  @Test
  fun scanCannotResurrectSourceRemovedDuringDiscovery() {
    dao.upsertSource(source().copy(localUri = "mediastore://camera"))
    val manager = SourceDiscoveryManager(
      accountRepository = storedAccountRepository(),
      recorder = SourceRevisionRecorder(dao),
      mediaDiscovery = MediaPresetDiscovery {
        dao.removeSource("source-1")
        MediaDiscovery(
          listOf(discoveredFile("provider", "photo.jpg", 50, 100)),
          MediaPermissionAccess.FULL,
        )
      },
      documentTreeDiscovery = DocumentTreeSourceDiscovery { emptyList() },
    )

    org.junit.Assert.assertThrows(EngineSourceNotFoundException::class.java) {
      manager.scan("source-1")
    }

    assertEquals(0, dao.sourceCount("source-1"))
    assertEquals(0, dao.revisionCount())
    assertEquals(0, dao.jobCount())
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
    accountId = "account-1",
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

  private fun discoveredFile(
    providerId: String,
    name: String,
    size: Long,
    modified: Long,
    relativePath: List<String> = emptyList(),
  ) = DiscoveredFile(
    providerId = providerId,
    localUri = "content://fixture/$providerId",
    fileName = name,
    relativePathSegments = relativePath,
    byteCount = size,
    modifiedAtEpochSeconds = modified,
    mimeType = "image/jpeg",
  )

  private fun storedAccountRepository() = object : AccountRepository {
    private val stored = StoredAccount(
      id = "account-1",
      serverUrl = "https://cloud.example.test",
      loginName = "login",
      davUserId = "dav-user",
      displayName = "Domi",
      checkedAt = "2026-09-04T12:00:00Z",
      capabilities = AccountCapabilities("34.0.0", true, null),
    )

    override fun currentAccount() = stored
    override fun credential(): StoredAccountCredential? = null
    override fun save(credential: StoredAccountCredential) = Unit
    override fun clear() = Unit
  }
}
