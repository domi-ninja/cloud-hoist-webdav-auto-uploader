package ninja.domi.cloudhoist.engine

interface RemoteFolderNetworkClient {
  fun listFolders(credential: StoredAccountCredential, pathSegments: List<String>): List<RemoteFolder>
  fun createFolder(
    credential: StoredAccountCredential,
    parentPathSegments: List<String>,
    name: String,
  ): RemoteFolder
}

class RemoteFolderManager(
  private val repository: AccountRepository,
  private val networkClient: RemoteFolderNetworkClient,
) {
  fun list(pathSegments: List<String>): List<RemoteFolder> {
    val normalizedPath = DavPath.validate(pathSegments)
    val account = credential()
    val folders = try {
      networkClient.listFolders(account, normalizedPath)
    } catch (error: DavNotFoundException) {
      // The account root belongs to the server; only recreate paths below it.
      if (normalizedPath.isEmpty()) throw error
      normalizedPath.forEachIndexed { index, name ->
        networkClient.createFolder(account, normalizedPath.take(index), name)
      }
      // Retry once so deletion races and failed creation cannot loop indefinitely.
      networkClient.listFolders(account, normalizedPath)
    }
    return folders.sortedBy { it.name.lowercase() }
  }

  fun create(parentPathSegments: List<String>, name: String): RemoteFolder {
    val parent = DavPath.validate(parentPathSegments)
    val folderName = DavPath.validateName(name)
    return networkClient.createFolder(credential(), parent, folderName)
  }

  private fun credential() = repository.credential() ?: throw AccountNotConfiguredException()
}

object DavPath {
  fun validate(pathSegments: List<String>): List<String> =
    pathSegments.map(::validateName)

  fun validateName(name: String): String {
    if (
      name.isBlank() ||
      name == "." ||
      name == ".." ||
      name.any { it == '/' || it == '\u0000' }
    ) {
      throw DavInvalidPathException()
    }
    return name
  }
}
