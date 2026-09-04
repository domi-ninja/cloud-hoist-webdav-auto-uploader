package ninja.domi.webdavautoupload.engine

import expo.modules.kotlin.exception.CodedException

enum class MediaPreset {
  CAMERA,
  SCREENSHOTS,
}

enum class MediaPermissionAccess {
  FULL,
  PARTIAL,
  DENIED,
}

data class MediaStoreItem(
  val providerId: String,
  val localUri: String,
  val displayName: String,
  val byteCount: Long,
  val modifiedAtEpochSeconds: Long?,
  val mimeType: String?,
  val relativePath: String?,
  val bucketDisplayName: String?,
)

data class DiscoveredFile(
  val providerId: String,
  val localUri: String,
  val fileName: String,
  val relativePathSegments: List<String>,
  val byteCount: Long,
  val modifiedAtEpochSeconds: Long,
  val mimeType: String?,
)

data class SourcePreview(
  val eligibleFileCount: Int,
  val totalBytes: Long,
  val permissionAccess: MediaPermissionAccess? = null,
)

data class DocumentTreeNode(
  val providerId: String,
  val displayName: String,
  val localUri: String,
  val isDirectory: Boolean,
  val isReadable: Boolean,
  val byteCount: Long?,
  val modifiedAtEpochMillis: Long?,
  val mimeType: String?,
)

interface DocumentTreeGateway {
  fun root(treeUri: String): DocumentTreeNode
  fun children(treeUri: String, directoryProviderId: String): List<DocumentTreeNode>
}

enum class SourceAccessBlocker {
  PERMISSION_REVOKED,
  FOLDER_UNAVAILABLE,
  UNREADABLE_DOCUMENT,
}

class SourceAccessException(
  val blocker: SourceAccessBlocker,
  message: String,
  cause: Throwable? = null,
) : CodedException("ERR_SOURCE_${blocker.name}", message, cause)

fun interface MediaPresetDiscovery {
  fun discover(preset: MediaPreset): MediaDiscovery
}

fun interface DocumentTreeSourceDiscovery {
  fun discover(treeUri: String): List<DiscoveredFile>
}

fun Iterable<DiscoveredFile>.toSourcePreview(
  permissionAccess: MediaPermissionAccess? = null,
): SourcePreview = SourcePreview(
  eligibleFileCount = count(),
  totalBytes = sumOf(DiscoveredFile::byteCount),
  permissionAccess = permissionAccess,
)

/** Media presets stay flat remotely, so their local directory is only used for classification. */
fun MediaStoreItem.forPreset(preset: MediaPreset): DiscoveredFile? {
  if (!belongsTo(preset)) return null
  if (displayName.isBlank() || byteCount < 0) return null

  return DiscoveredFile(
    providerId = providerId,
    localUri = localUri,
    fileName = displayName,
    relativePathSegments = emptyList(),
    byteCount = byteCount,
    modifiedAtEpochSeconds = modifiedAtEpochSeconds ?: 0,
    mimeType = mimeType,
  )
}

private fun MediaStoreItem.belongsTo(preset: MediaPreset): Boolean {
  val expectedDirectory = when (preset) {
    MediaPreset.CAMERA -> "camera"
    MediaPreset.SCREENSHOTS -> "screenshots"
  }
  val directoryNames = relativePath
    ?.split('/')
    ?.filter(String::isNotBlank)
    .orEmpty()

  return bucketDisplayName.equals(expectedDirectory, ignoreCase = true) ||
    directoryNames.lastOrNull().equals(expectedDirectory, ignoreCase = true)
}
