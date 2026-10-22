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
  @Test fun conflictingFilenameIsReportedWithSpecificFileAndDoesNotOverwrite() {
    val old = source("one"); val target = listOf("Old", "New", "one.jpg")
    network.files[target] = "unrelated"
    val op = run(target.dropLast(1))
    assertEquals("failed", op.state)
    assertEquals("one", op.errorSourceId); assertEquals("/Old/Custom/one.jpg", op.errorFile)
    assertTrue(op.message!!.contains("already exists"))
    assertEquals("unrelated", network.files[target]); assertTrue(network.files.containsKey(old))
    assertEquals(listOf("Old", "Custom"), dao.source("one")!!.remotePathSegments)
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
    network.files[listOf("New", "B", "two.jpg")] = "conflict"
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
    val op = manager().pending()!!; manager().run(op.id); manager().acknowledge(op.id)
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
    var loseResponse = false
    var failBeforeMove = false
    override fun etag(credential: StoredAccountCredential, path: List<String>) = files[path]
    override fun ensureFolder(credential: StoredAccountCredential, path: List<String>) = Unit
    override fun relocate(credential: StoredAccountCredential, from: List<String>, to: List<String>, etag: String, copy: Boolean) {
      if (failBeforeMove) throw AccountNetworkException()
      check(files[from] == etag)
      if (to in files) throw EngineInvalidInputException("A file already exists at the destination. No existing file was overwritten.")
      calls.add(Triple(from, to, copy)); files[to] = files[from]!!
      if (!copy) files.remove(from)
      if (loseResponse) { loseResponse = false; throw AccountNetworkException() }
    }
  }
}
