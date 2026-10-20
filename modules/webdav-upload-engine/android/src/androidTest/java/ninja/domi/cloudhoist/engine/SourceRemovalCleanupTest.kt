package ninja.domi.cloudhoist.engine

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SourceRemovalCleanupTest {
  private lateinit var context: Context
  private lateinit var database: EngineRoomDatabase
  private lateinit var dao: EngineDao
  private val released = mutableListOf<String>()

  @Before
  fun setUp() {
    context = ApplicationProvider.getApplicationContext()
    preferences().edit().clear().commit()
    database = Room.inMemoryDatabaseBuilder(context, EngineRoomDatabase::class.java)
      .allowMainThreadQueries()
      .build()
    dao = database.engineDao()
    dao.upsertAccount(account())
    dao.upsertSource(source("source-1"))
  }

  @After
  fun tearDown() {
    preferences().edit().clear().commit()
    database.close()
  }

  @Test
  fun normalRemovalReleasesTheLastGrant() {
    val cleanup = cleanup()

    cleanup.remove("source-1") { dao.removeSource("source-1") }

    assertNull(dao.source("source-1"))
    assertEquals(listOf(SOURCE_URI), released)
  }

  @Test
  fun interruptedBeforeDeletionKeepsTheGrant() {
    val cleanup = cleanup()

    cleanup.prepare(checkNotNull(dao.source("source-1")))
    cleanup().finishInterruptedRemoval()

    assertNotNull(dao.source("source-1"))
    assertEquals(emptyList<String>(), released)
    assertEquals(emptyMap<String, Any>(), preferences().all)
  }

  @Test
  fun interruptedAfterDeletionReleasesTheGrantOnRestart() {
    val cleanup = cleanup()

    cleanup.prepare(checkNotNull(dao.source("source-1")))
    dao.removeSource("source-1")
    cleanup().finishInterruptedRemoval()

    assertEquals(listOf(SOURCE_URI), released)
    assertEquals(emptyMap<String, Any>(), preferences().all)
  }

  @Test
  fun sharedGrantRemainsUntilTheLastSourceIsRemoved() {
    dao.upsertSource(source("source-2"))
    val cleanup = cleanup()

    cleanup.remove("source-1") { dao.removeSource("source-1") }
    assertEquals(emptyList<String>(), released)
    cleanup.remove("source-2") { dao.removeSource("source-2") }

    assertEquals(listOf(SOURCE_URI), released)
  }

  private fun cleanup() = SourceRemovalCleanup(context, dao, released::add)

  private fun preferences() = context.getSharedPreferences(
    "webdav_source_removal_cleanup",
    Context.MODE_PRIVATE,
  )

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

  private fun source(id: String) = SourceEntity(
    id = id,
    accountId = "account",
    name = "Folder",
    kind = "saf",
    localUri = SOURCE_URI,
    remotePathSegments = listOf("Auto Upload"),
    enabled = true,
    createdAt = 1,
    lastScanAt = null,
    blockerCode = null,
  )

  private companion object {
    const val SOURCE_URI = "content://fixture/tree"
  }
}
