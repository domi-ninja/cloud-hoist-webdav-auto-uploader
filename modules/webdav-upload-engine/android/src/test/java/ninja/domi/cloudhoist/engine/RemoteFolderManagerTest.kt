package ninja.domi.cloudhoist.engine

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
    assertEquals(emptyList<List<String>>(), network.created)
    assertThrows(DavInvalidPathException::class.java) { manager.list(listOf("..")) }
    assertThrows(DavInvalidPathException::class.java) { manager.create(emptyList(), "a/b") }
  }

  @Test
  fun requiresAnAccount() {
    val manager = RemoteFolderManager(FakeAccountRepository(null), FakeFolderClient())
    assertThrows(AccountNotConfiguredException::class.java) { manager.list(emptyList()) }
  }

  @Test
  fun createsMissingParentsThenReloadsTheListing() {
    val path = listOf("Phone Uploads", "Documents", "Grüezi # %")
    val network = FakeFolderClient().apply {
      listFailures.add(DavNotFoundException())
      folders = listOf(RemoteFolder("Child", path + "Child"))
    }

    assertEquals(network.folders, RemoteFolderManager(FakeAccountRepository(), network).list(path))
    assertEquals(listOf(path.take(1), path.take(2), path), network.created)
    assertEquals(listOf(path, path), network.listed)
  }

  @Test
  fun reloadsAnExistingFolderWithoutTryingToCreateIt() {
    val network = FakeFolderClient()
    RemoteFolderManager(FakeAccountRepository(), network).list(listOf("Existing"))
    assertEquals(emptyList<List<String>>(), network.created)
  }

  @Test
  fun doesNotCreateAnythingForOtherListingFailures() {
    for (failure in listOf(
      DavPermissionException(), AccountInvalidCredentialsException(), AccountNetworkException(),
      AccountTimeoutException(), AccountServerException(),
    )) {
      val network = FakeFolderClient().apply { listFailures.add(failure) }
      val manager = RemoteFolderManager(FakeAccountRepository(), network)
      assertEquals(failure, assertThrows(failure.javaClass) { manager.list(listOf("Folder")) })
      assertEquals(emptyList<List<String>>(), network.created)
    }
  }

  @Test
  fun doesNotTryToCreateTheAccountRoot() {
    val network = FakeFolderClient().apply { listFailures.add(DavNotFoundException()) }
    assertThrows(DavNotFoundException::class.java) {
      RemoteFolderManager(FakeAccountRepository(), network).list(emptyList())
    }
    assertEquals(emptyList<List<String>>(), network.created)
    assertEquals(1, network.listed.size)
  }

  @Test
  fun stopsWhenCreationFailsAndCanRetryLater() {
    val network = FakeFolderClient().apply {
      listFailures.add(DavNotFoundException())
      creationFailure = DavQuotaException()
    }
    val manager = RemoteFolderManager(FakeAccountRepository(), network)
    val path = listOf("Parent", "Child")
    assertThrows(DavQuotaException::class.java) { manager.list(path) }
    assertEquals(listOf(path.take(1)), network.created)
    assertEquals(1, network.listed.size)

    network.creationFailure = null
    network.listFailures.add(DavNotFoundException())
    assertEquals(emptyList<RemoteFolder>(), manager.list(path))
    assertEquals(listOf(path.take(1), path.take(1), path), network.created)
  }

  @Test
  fun doesNotLoopWhenTheFolderIsStillMissingAfterCreation() {
    val network = FakeFolderClient().apply {
      listFailures.addAll(listOf(DavNotFoundException(), DavNotFoundException()))
    }
    val path = listOf("Folder")
    assertThrows(DavNotFoundException::class.java) {
      RemoteFolderManager(FakeAccountRepository(), network).list(path)
    }
    assertEquals(listOf(path), network.created)
    assertEquals(listOf(path, path), network.listed)
  }

  @Test
  fun validatesTheWholePathBeforeNetworkAccess() {
    val network = FakeFolderClient()
    val manager = RemoteFolderManager(FakeAccountRepository(), network)
    assertThrows(DavInvalidPathException::class.java) { manager.list(listOf("Parent", "..")) }
    assertEquals(emptyList<List<String>>(), network.listed)
    assertEquals(emptyList<List<String>>(), network.created)
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
    val listed = mutableListOf<List<String>>()
    val created = mutableListOf<List<String>>()
    val listFailures = mutableListOf<Exception>()
    var creationFailure: Exception? = null
    override fun listFolders(
      credential: StoredAccountCredential,
      pathSegments: List<String>,
    ): List<RemoteFolder> {
      listed.add(pathSegments)
      if (listFailures.isNotEmpty()) throw listFailures.removeAt(0)
      return folders
    }

    override fun createFolder(
      credential: StoredAccountCredential,
      parentPathSegments: List<String>,
      name: String,
    ): RemoteFolder {
      created.add(parentPathSegments + name)
      creationFailure?.let { throw it }
      return RemoteFolder(name, parentPathSegments + name)
    }
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
