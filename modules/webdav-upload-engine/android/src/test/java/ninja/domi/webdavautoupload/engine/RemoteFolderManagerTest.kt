package ninja.domi.webdavautoupload.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RemoteFolderManagerTest {
  @Test
  fun validatesPathsAndSortsFolders() {
    val network = FakeFolderClient()
    val manager = RemoteFolderManager(FakeAccountRepository(), network)
    network.folders = listOf(
      RemoteFolder("zeta", listOf("zeta")),
      RemoteFolder("Älbum", listOf("Älbum")),
      RemoteFolder("Camera", listOf("Camera")),
    )

    assertEquals(listOf("Camera", "zeta", "Älbum"), manager.list(emptyList()).map { it.name })
    assertThrows(DavInvalidPathException::class.java) { manager.list(listOf("..")) }
    assertThrows(DavInvalidPathException::class.java) { manager.create(emptyList(), "a/b") }
  }

  @Test
  fun requiresAnAccount() {
    val manager = RemoteFolderManager(FakeAccountRepository(null), FakeFolderClient())
    assertThrows(AccountNotConfiguredException::class.java) { manager.list(emptyList()) }
  }

  private class FakeAccountRepository(
    private val stored: StoredAccountCredential? = credential(),
  ) : AccountRepository {
    override fun currentAccount() = stored?.account
    override fun credential() = stored
    override fun save(credential: StoredAccountCredential) = Unit
    override fun clear() = Unit
  }

  private class FakeFolderClient : RemoteFolderNetworkClient {
    var folders = emptyList<RemoteFolder>()
    override fun listFolders(
      credential: StoredAccountCredential,
      pathSegments: List<String>,
    ) = folders

    override fun createFolder(
      credential: StoredAccountCredential,
      parentPathSegments: List<String>,
      name: String,
    ) = RemoteFolder(name, parentPathSegments + name)
  }

  private companion object {
    fun credential(): StoredAccountCredential {
      val account = StoredAccount(
        id = "account-1",
        serverUrl = "https://cloud.example.test",
        loginName = "login",
        davUserId = "dav-user",
        displayName = "Domi",
        checkedAt = "2026-09-04T12:00:00Z",
        capabilities = AccountCapabilities("34.0.0", true, null),
      )
      return StoredAccountCredential(account, "secret")
    }
  }
}
