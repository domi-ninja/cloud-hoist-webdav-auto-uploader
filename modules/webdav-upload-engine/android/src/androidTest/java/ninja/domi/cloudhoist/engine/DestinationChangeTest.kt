package ninja.domi.cloudhoist.engine

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DestinationChangeTest {
  private lateinit var database: EngineRoomDatabase
  private lateinit var dao: EngineDao
  private val network = FakeDestinationNetwork()
  private val credential = StoredAccountCredential(StoredAccount("account", "https://cloud.example.test", "login", "dav", "Test", "2026-10-22T00:00:00Z", AccountCapabilities("34", true, null)), "test-password")
  private val repository = object : AccountRepository {
    override fun currentAccount() = credential.account
    override fun credential() = credential
    override fun save(credential: StoredAccountCredential) = Unit
    override fun clear() = Unit
  }
  private fun manager() = DestinationChangeManager(database, repository, network)
  private fun request(target: List<String>, source: String? = "one") = DestinationChangeRequest().apply {
    sourceId = source; pathSegments = target; rootChange = source == null
  }

  @Before fun setup() {
    database = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext<Context>(), EngineRoomDatabase::class.java).allowMainThreadQueries().build()
    dao = database.engineDao()
    dao.upsertAccount(AccountEntity("account", "https://cloud.example.test", "login", "dav", "Test", 1, "34", true, null, "test"))
    manager().root(listOf("Old"))
  }
  @After fun close() { database.close(); EngineOperations.destinationRequested = false }

  private fun source(id: String, path: List<String> = listOf("Old", "Custom"), enabled: Boolean = true, name: String = "$id.jpg"): List<String> {
    dao.upsertSource(SourceEntity(id, "account", id, "media_store", "mediastore://folder/$id", path, enabled, 1, 100, null))
    val revision = LocalRevisionEntity("revision-$id", id, id, "content://test/$id", name, 10, 1, 100)
    dao.enqueueRevision(revision, UploadJobEntity("job-$id", "account", id, revision.id, path, name, JobState.COMPLETED, 1, null, 2, null, 0, null, null, null))
    return (path + name).also { network.files[it] = "etag-$id" }
  }
  private fun run(target: List<String>, source: String? = "one", mode: String = "move"): DestinationOperation {
    val change = manager().begin(request(target, source), mode)
    manager().run(change["id"] as String)
    return manager().pending()!!
  }

  @Test fun rootChangeMovesMultipleFoldersIncludingDisabledAndPreservesCustomSuffixes() {
    val a = source("one", listOf("Old", "Custom", "Keep"))
    val b = source("two", listOf("Old", "Another"), false)
    val op = run(listOf("New"), null)
    assertEquals("completed", op.state)
    assertEquals(listOf("New", "Custom", "Keep"), dao.source("one")!!.remotePathSegments)
    assertEquals(listOf("New", "Another"), dao.source("two")!!.remotePathSegments)
    assertFalse(dao.source("two")!!.enabled)
    assertFalse(network.files.containsKey(a)); assertFalse(network.files.containsKey(b))
    assertEquals(listOf("New"), manager().root())
    assertEquals(JobState.COMPLETED, dao.job("job-one")!!.state)
  }
  @Test fun leaveFilesAndUploadCopiesRequeuesOnlyCurrentFilesAndRetargetsQueue() {
    val old = source("one")
    val op = run(listOf("Old", "Exact"), mode = "copy")
    assertEquals("completed", op.state)
    assertTrue(network.files.containsKey(old)); assertTrue(network.calls.isEmpty())
    assertEquals(listOf("Old", "Exact"), dao.job("job-one")!!.remotePathSegments)
    assertEquals(JobState.QUEUED, dao.job("job-one")!!.state)
    assertNull(dao.job("job-one")!!.completedAt)
  }
  @Test fun missingRemoteIsRequeuedInsteadOfClaimingItWasMoved() {
    val old = source("one"); network.files.remove(old)
    val op = run(listOf("Old", "New"))
    assertEquals("completed", op.state)
    assertEquals(JobState.QUEUED, dao.job("job-one")!!.state)
  }
  @Test fun conflictingFilenameGetsNextFreeSuffixAndUpdatesJob() {
    val old = source("one"); val target = listOf("Old", "New", "one.jpg")
    network.files[target] = "unrelated"
    network.files[numberedDestination(target, 1)] = "also-unrelated"
    val op = run(target.dropLast(1))
    assertEquals("completed", op.state)
    assertEquals("unrelated", network.files[target]); assertFalse(network.files.containsKey(old))
    assertEquals("etag-one", network.files[numberedDestination(target, 2)])
    assertEquals("one_2.jpg", dao.job("job-one")!!.remoteFileName)
  }
  @Test fun identicalContentWithDifferentEtagsDeletesOnlyOriginal() {
    val old = source("one"); val target = listOf("Old", "New", "one.jpg")
    network.files[target] = "different-version"
    network.hashes[old] = "same-content"; network.hashes[target] = "same-content"
    val op = run(target.dropLast(1))
    assertEquals("completed", op.state)
    assertFalse(network.files.containsKey(old)); assertEquals("different-version", network.files[target])
    assertEquals(listOf(old), network.deletions); assertTrue(network.calls.isEmpty())
  }
  @Test fun lostDeleteResponseRecoversUsingDestinationVersionAfterRestart() {
    val old = source("one"); val target = listOf("Old", "New", "one.jpg")
    network.files[target] = "different-version"
    network.hashes[old] = "same"; network.hashes[target] = "same"
    network.loseDeleteResponse = true
    val op = run(target.dropLast(1))
    assertEquals("failed", op.state)
    manager().run(op.id)
    assertEquals("completed", manager().pending()!!.state)
    assertEquals(1, network.deletions.size)
    assertEquals(JobState.COMPLETED, dao.job("job-one")!!.state)
  }
  @Test fun lostRenamedMoveResponseRetainsChosenNameAfterRestart() {
    source("one"); val target = listOf("Old", "New", "one.jpg")
    network.files[target] = "other"; network.loseResponse = true
    val op = run(target.dropLast(1))
    assertEquals("failed", op.state)
    manager().run(op.id)
    assertEquals("completed", manager().pending()!!.state)
    assertEquals("one_1.jpg", dao.job("job-one")!!.remoteFileName)
    assertEquals(1, network.calls.size)
  }
  private fun collidingBatch(count: Int): DestinationOperation {
    for (i in 1..count) {
      val old = source("batch-$i", listOf("Old", "Batch"))
      val target = listOf("New", "Batch", "batch-$i.jpg")
      network.files[target] = "destination-$i"
      network.hashes[old] = "same"; network.hashes[target] = "same"
    }
    return run(listOf("New"), null)
  }
  @Test fun twentyFilesCompareContent() {
    assertEquals("completed", collidingBatch(20).state)
    assertEquals(40, network.hashCalls); assertEquals(20, network.deletions.size)
  }
  @Test fun twentyOneFilesSkipHashingEvenWhenIdentical() {
    assertEquals("completed", collidingBatch(21).state)
    assertEquals(0, network.hashCalls); assertTrue(network.deletions.isEmpty())
    assertEquals("batch-1_1.jpg", dao.job("job-batch-1")!!.remoteFileName)
  }
  @Test fun sharedIdenticalOriginalIsNotDeleted() {
    val old = source("one", name = "shared.jpg"); source("two", name = "shared.jpg")
    val target = listOf("Old", "New", "shared.jpg")
    network.files[target] = "different"
    network.hashes[old] = "same"; network.hashes[target] = "same"
    assertEquals("completed", run(target.dropLast(1)).state)
    assertTrue(network.files.containsKey(old)); assertTrue(network.deletions.isEmpty())
  }
  @Test fun collisionAppearingAfterLookupRetriesAutomatically() {
    source("one"); network.raceDestination = true
    val op = run(listOf("Old", "New"))
    assertEquals("completed", op.state)
    assertEquals("one_1.jpg", dao.job("job-one")!!.remoteFileName)
    assertEquals("racing-file", network.files[listOf("Old", "New", "one.jpg")])
  }
  @Test fun interruptedMoveRecoversAfterManagerRestartWithoutSecondMove() {
    val old = source("one"); network.loseResponse = true
    val op = run(listOf("Old", "New"))
    assertEquals("failed", op.state); assertFalse(network.files.containsKey(old))
    manager().run(op.id)
    assertEquals("completed", manager().pending()!!.state)
    assertEquals(1, network.calls.size)
    assertEquals(JobState.COMPLETED, dao.job("job-one")!!.state)
  }
  @Test fun switchingToCopiesAfterLostMoveResponseKeepsRemoteOnlyArchiveTracked() {
    source("one")
    dao.upsertSource(dao.source("one")!!.copy(lastScanAt = 200))
    network.loseResponse = true
    val op = run(listOf("Old", "New"))
    assertEquals("failed", op.state)
    manager().run(op.id, uploadCopies = true)
    assertEquals("completed", manager().pending()!!.state)
    assertEquals(listOf("Old", "New"), dao.job("job-one")!!.remotePathSegments)
    assertEquals(JobState.COMPLETED, dao.job("job-one")!!.state)
  }
  @Test fun changedDestinationAfterLostDeleteResponseDoesNotClaimSuccess() {
    val old = source("one"); val target = listOf("Old", "New", "one.jpg")
    network.files[target] = "different-version"
    network.hashes[old] = "same"; network.hashes[target] = "same"
    network.loseDeleteResponse = true
    val op = run(target.dropLast(1))
    network.files[target] = "changed-after-delete"
    manager().run(op.id)
    assertEquals("failed", manager().pending()!!.state)
    assertEquals(listOf("Old", "Custom"), dao.source("one")!!.remotePathSegments)
  }
  @Test fun sharedPhysicalCollisionIsRenamedOnlyOnceAcrossBackups() {
    source("one", name = "shared.jpg"); source("two", name = "shared.jpg")
    network.files[listOf("New", "Custom", "shared.jpg")] = "other"
    val op = run(listOf("New"), null)
    assertEquals("completed", op.state); assertEquals(1, network.calls.size)
    assertEquals("shared_1.jpg", dao.job("job-one")!!.remoteFileName)
    assertEquals("shared_1.jpg", dao.job("job-two")!!.remoteFileName)
  }
  @Test fun remoteChangedDuringInterruptedMoveIsNotMovedOnRetry() {
    val old = source("one"); network.failBeforeMove = true
    val op = run(listOf("Old", "New"))
    network.failBeforeMove = false; network.files[old] = "changed"
    manager().run(op.id)
    assertEquals("failed", manager().pending()!!.state)
    assertTrue(manager().pending()!!.message!!.contains("changed"))
    assertEquals("changed", network.files[old])
  }
  @Test fun partialFailureCanLeaveRemainingFilesAndUploadCopies() {
    val a = source("one", listOf("Old", "A")); val b = source("two", listOf("Old", "B"))
    network.failPath = b
    val op = run(listOf("New"), null)
    assertEquals("failed", op.state); assertEquals(1, op.files.count { it.done })
    manager().run(op.id, uploadCopies = true)
    assertEquals("completed", manager().pending()!!.state)
    assertFalse(network.files.containsKey(a)); assertTrue(network.files.containsKey(b))
    assertEquals(JobState.COMPLETED, dao.job("job-one")!!.state)
    assertEquals(JobState.QUEUED, dao.job("job-two")!!.state)
  }
  @Test fun multipleBackupsCanUseExactSameTargetWithoutAddingLocalNames() {
    source("one", listOf("Old", "A")); source("two", listOf("Old", "Shared"))
    val op = run(listOf("Old", "Shared"))
    assertEquals("completed", op.state)
    assertEquals(dao.source("two")!!.remotePathSegments, dao.source("one")!!.remotePathSegments)
    assertTrue(network.files.containsKey(listOf("Old", "Shared", "one.jpg")))
    assertTrue(network.files.containsKey(listOf("Old", "Shared", "two.jpg")))
  }
  @Test fun sharedOriginalRemainsForBackupThatDidNotChange() {
    val original = source("one", name = "shared.jpg")
    source("two", name = "shared.jpg")
    val op = run(listOf("Old", "New"))
    assertEquals("completed", op.state)
    assertTrue(network.files.containsKey(original))
    assertEquals(true, network.calls.single().third)
  }
  @Test fun duplicatePhysicalMovesAcrossSharedSourcesArePerformedOnce() {
    source("one", name = "shared.jpg"); source("two", name = "shared.jpg")
    val op = run(listOf("New"), null)
    assertEquals("completed", op.state); assertEquals(1, network.calls.size)
    assertTrue(op.files.all { it.present })
  }
  @Test fun rejectsEscapingRootBySegmentEvenIfNamesHaveCommonPrefix() {
    source("one")
    val error = assertThrows(EngineInvalidInputException::class.java) {
      manager().preview(request(listOf("Older", "New")))
    }
    assertTrue(error.message!!.contains("inside /Old"))
    assertNull(manager().pending())
  }
  @Test fun editedFileHistoryDoesNotCountTwiceAfterMoving() {
    source("one")
    val old = dao.revision("revision-one")!!.copy(id = "previous", byteCount = 5, lastSeenAt = 50)
    dao.enqueueRevision(old, dao.job("job-one")!!.copy(id = "previous-job", revisionId = "previous"))
    assertEquals("completed", run(listOf("Old", "New")).state)
    assertEquals(1, dao.sourceQueueCounts().single().uploaded)
  }
  @Test fun trackedRemoteArchivesMoveButCopyChoiceDoesNotQueueDeletedPhoneFiles() {
    val original = source("one")
    dao.upsertSource(dao.source("one")!!.copy(lastScanAt = 200))
    val op = run(listOf("Old", "New"))
    assertEquals("completed", op.state)
    assertFalse(network.files.containsKey(original))
    assertEquals(JobState.COMPLETED, dao.job("job-one")!!.state)
    manager().acknowledge(op.id)
    val copy = run(listOf("Old", "Another"), mode = "copy")
    assertEquals("completed", copy.state)
    assertEquals(JobState.COMPLETED, dao.job("job-one")!!.state)
    assertEquals(listOf("Old", "New"), dao.job("job-one")!!.remotePathSegments)
  }
  @Test fun pendingChangeHoldsUploadsAndPreventsUnconfirmedDestinationEdits() {
    source("one")
    manager().begin(request(listOf("Old", "New")), "move")
    assertTrue(EngineOperations.held(dao))
    assertThrows(EngineInvalidInputException::class.java) { EngineOperations.requireAvailable(dao) }
    assertThrows(EngineInvalidInputException::class.java) { manager().acknowledge(manager().pending()!!.id) }
    val op = manager().pending()!!; manager().run(op.id)
    assertFalse(EngineOperations.held(dao))
    manager().acknowledge(op.id)
    assertFalse(EngineOperations.held(dao))
  }
  @Test fun failedFileNoLongerOnPhoneStillAppearsWithItsReason() {
    source("one")
    dao.upsertSource(dao.source("one")!!.copy(lastScanAt = 200))
    dao.updateJob(dao.job("job-one")!!.copy(state = JobState.BLOCKED, lastErrorCode = "local_missing"))
    val inventory = FileInventoryManager(dao, repository, object : RemoteInventoryClient {
      override fun listFiles(credential: StoredAccountCredential, rootPathSegments: List<String>) = emptyList<RemoteInventoryFile>()
    }).page(0)
    val item = inventory.items.single()
    assertEquals("job-one", item["jobId"])
    assertEquals("The local file is no longer available.", (item["transfer"] as Map<*, *>)["message"])
  }

  private class FakeDestinationNetwork : DestinationNetworkClient {
    val files = mutableMapOf<List<String>, String>()
    val calls = mutableListOf<Triple<List<String>, List<String>, Boolean>>()
    val hashes = mutableMapOf<List<String>, String>()
    val deletions = mutableListOf<List<String>>()
    var hashCalls = 0
    var loseDeleteResponse = false
    var raceDestination = false
    var failPath: List<String>? = null
    override fun hash(credential: StoredAccountCredential, path: List<String>, etag: String): String {
      check(files[path] == etag); hashCalls++
      return hashes[path] ?: "content-$etag"
    }
    override fun deleteDuplicate(credential: StoredAccountCredential, from: List<String>, to: List<String>, sourceEtag: String, targetEtag: String) {
      check(files[from] == sourceEtag && files[to] == targetEtag)
      files.remove(from); deletions.add(from)
      if (loseDeleteResponse) { loseDeleteResponse = false; throw AccountNetworkException() }
    }
    var loseResponse = false
    var failBeforeMove = false
    override fun etag(credential: StoredAccountCredential, path: List<String>) = files[path]
    override fun ensureFolder(credential: StoredAccountCredential, path: List<String>) = Unit
    override fun relocate(credential: StoredAccountCredential, from: List<String>, to: List<String>, etag: String, copy: Boolean) {
      if (failBeforeMove || from == failPath) throw AccountNetworkException()
      check(files[from] == etag)
      if (raceDestination) { raceDestination = false; files[to] = "racing-file" }
      if (to in files) throw DestinationPreconditionException()
      calls.add(Triple(from, to, copy)); files[to] = files[from]!!
      if (!copy) files.remove(from)
      if (loseResponse) { loseResponse = false; throw AccountNetworkException() }
    }
  }
}
