package ninja.domi.cloudhoist.engine

import android.net.Uri

data class MediaFolder(val volumeName: String, val relativePath: String, val fileCount: Int, val totalBytes: Long, val latestFileAt: Long? = null)

/** Group the actual media index by volume and full directory, rather than app names. */
fun groupMediaFolders(items: List<MediaStoreItem>): List<MediaFolder> = items
  .filter { !it.relativePath.isNullOrBlank() && it.byteCount >= 0 && it.displayName.isNotBlank() }
  .groupBy { it.volumeName to it.relativePath!! }
  .map { (location, files) ->
    val latest = files.flatMap { listOfNotNull(it.modifiedAtEpochSeconds, it.createdAtEpochSeconds) }
      .filter { it > 0 }.maxOrNull()
    MediaFolder(location.first, location.second, files.size, files.sumOf { it.byteCount }, latest)
  }

fun validateMediaFolder(volumeName: String, relativePath: String) {
  if (volumeName.isBlank() || relativePath.isBlank() || !relativePath.endsWith('/') ||
    relativePath.startsWith('/') || relativePath.split('/').any { it == ".." || it == "." }
  ) throw EngineInvalidInputException("The media folder path is invalid.")
}

fun mediaFolderUri(volumeName: String, relativePath: String): String {
  validateMediaFolder(volumeName, relativePath)
  return "mediastore://folder/${Uri.encode(volumeName)}/${Uri.encode(relativePath)}"
}

fun mediaFolderSelection(value: String): SourceSelection {
  val parts = value.removePrefix("mediastore://folder/").split('/')
  if (parts.size != 2) throw EngineInvalidInputException("The media folder is invalid.")
  val volume = Uri.decode(parts[0])
  val path = Uri.decode(parts[1])
  validateMediaFolder(volume, path)
  return SourceSelection(SourceType.MEDIA_FOLDER, volumeName = volume, relativePath = path)
}

fun MediaStoreItem.asDiscoveredFile(): DiscoveredFile? {
  if (displayName.isBlank() || byteCount < 0) return null
  return DiscoveredFile(providerId, localUri, displayName, emptyList(), byteCount,
    modifiedAtEpochSeconds ?: 0, mimeType, createdAtEpochSeconds)
}
