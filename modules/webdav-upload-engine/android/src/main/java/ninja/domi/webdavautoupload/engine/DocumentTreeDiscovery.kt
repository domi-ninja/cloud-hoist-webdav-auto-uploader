package ninja.domi.webdavautoupload.engine

class DocumentTreeDiscovery(
  private val gateway: DocumentTreeGateway,
) : DocumentTreeSourceDiscovery {
  override fun discover(treeUri: String): List<DiscoveredFile> {
    val root = gateway.root(treeUri)
    if (!root.isDirectory) {
      throw SourceAccessException(
        SourceAccessBlocker.FOLDER_UNAVAILABLE,
        "The selected folder is no longer available.",
      )
    }

    val pending = ArrayDeque<DirectoryToVisit>()
    val visitedDirectoryIds = mutableSetOf(root.providerId)
    pending += DirectoryToVisit(root.providerId, emptyList())
    val files = mutableListOf<DiscoveredFile>()

    while (pending.isNotEmpty()) {
      val directory = pending.removeFirst()
      for (node in gateway.children(treeUri, directory.providerId)) {
        if (node.displayName == ".nomedia") continue
        if (!node.isReadable) {
          throw SourceAccessException(
            SourceAccessBlocker.UNREADABLE_DOCUMENT,
            "'${node.displayName}' is no longer readable.",
          )
        }
        if (node.displayName.isBlank()) continue

        if (node.isDirectory) {
          if (visitedDirectoryIds.add(node.providerId)) {
            pending += DirectoryToVisit(
              node.providerId,
              directory.relativePathSegments + node.displayName,
            )
          }
          continue
        }

        files += DiscoveredFile(
          providerId = node.providerId,
          localUri = node.localUri,
          fileName = node.displayName,
          relativePathSegments = directory.relativePathSegments,
          byteCount = node.byteCount?.coerceAtLeast(0) ?: 0,
          modifiedAtEpochSeconds = node.modifiedAtEpochMillis
            ?.coerceAtLeast(0)
            ?.div(1_000)
            ?: 0,
          mimeType = node.mimeType,
        )
      }
    }

    return files.sortedWith(
      compareBy(DiscoveredFile::modifiedAtEpochSeconds, DiscoveredFile::providerId),
    )
  }

  private data class DirectoryToVisit(
    val providerId: String,
    val relativePathSegments: List<String>,
  )
}
