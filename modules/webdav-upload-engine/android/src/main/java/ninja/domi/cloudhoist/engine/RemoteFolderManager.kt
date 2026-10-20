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
    return networkClient.listFolders(credential(), normalizedPath)
      .sortedBy { it.name.lowercase() }
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
