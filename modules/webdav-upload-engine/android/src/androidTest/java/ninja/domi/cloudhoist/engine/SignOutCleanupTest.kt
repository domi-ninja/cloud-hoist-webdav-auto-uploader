package ninja.domi.cloudhoist.engine

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SignOutCleanupTest {
  private lateinit var context: Context
  private lateinit var database: EngineRoomDatabase
  private lateinit var dao: EngineDao

  @Before
  fun setUp() {
    context = ApplicationProvider.getApplicationContext()
    context.getSharedPreferences("webdav_sign_out_cleanup", Context.MODE_PRIVATE)
      .edit().clear().commit()
    database = Room.inMemoryDatabaseBuilder(context, EngineRoomDatabase::class.java)
      .allowMainThreadQueries()
      .build()
    dao = database.engineDao()
    dao.upsertAccount(account())
    dao.upsertSource(source())
  }

  @After
  fun tearDown() {
    context.getSharedPreferences("webdav_sign_out_cleanup", Context.MODE_PRIVATE)
      .edit().clear().commit()
    database.close()
  }

  @Test
  fun resumesCleanupAfterDataWasPartlyRemoved() {
    val released = mutableListOf<String>()
    var cancellations = 0
    var clears = 0
    var diagnosticClears = 0
    var remoteCleanups = 0
    val repository = object : AccountRepository {
      override fun currentAccount(): StoredAccount? = null
      override fun credential(): StoredAccountCredential? = null
      override fun save(credential: StoredAccountCredential) = Unit
      override fun clear() {
        clears += 1
        dao.wipe()
      }
    }
    val cleanup = SignOutCleanup(
      context,
      dao,
      repository,
      EnginePreferences(context),
      cancelWork = { cancellations += 1 },
      releaseReadPermission = released::add,
      cleanupRemoteSessions = { remoteCleanups += 1 },
      clearDiagnostics = { diagnosticClears += 1 },
    )

    cleanup.prepare()
    repository.clear()
    cleanup.finishInterruptedSignOut()

    assertEquals(2, clears)
    assertEquals(1, cancellations)
    assertEquals(1, remoteCleanups)
    assertEquals(1, diagnosticClears)
    assertEquals(listOf("content://fixture/tree"), released)
    assertNull(dao.account("account"))
    assertFalse(
      context.getSharedPreferences("webdav_sign_out_cleanup", Context.MODE_PRIVATE)
        .contains("inProgress"),
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
    name = "Folder",
    kind = "saf",
    localUri = "content://fixture/tree",
    remotePathSegments = listOf("Auto Upload"),
    enabled = true,
    createdAt = 1,
    lastScanAt = null,
    blockerCode = null,
  )
}
