package ninja.domi.cloudhoist.engine

import android.Manifest
import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore

data class MediaDiscovery(
  val files: List<DiscoveredFile>,
  val permissionAccess: MediaPermissionAccess,
) {
  val preview: SourcePreview
    get() = files.toSourcePreview(permissionAccess)
}

class AndroidMediaStoreDiscovery(
  context: Context,
  private val contentResolver: ContentResolver = context.contentResolver,
  private val permissionAccess: () -> MediaPermissionAccess = {
    currentMediaPermissionAccess(context)
  },
) : MediaPresetDiscovery {
  override fun discover(preset: MediaPreset) = MediaDiscovery(
    queryItems().mapNotNull { it.forPreset(preset) }, permissionAccess(),
  )

  override fun discoverFolder(volumeName: String, relativePath: String): MediaDiscovery {
    validateMediaFolder(volumeName, relativePath)
    val items = queryItems(volumeName, relativePath)
    return MediaDiscovery(items.mapNotNull { it.asDiscoveredFile() }, permissionAccess())
  }

  fun folders(): List<MediaFolder> = groupMediaFolders(queryItems())

  private fun queryItems(volumeName: String? = null, relativePath: String? = null): List<MediaStoreItem> {
    return buildList {
      contentResolver.query(
        MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL),
        PROJECTION,
        if (relativePath == null) MEDIA_SELECTION else
          "$MEDIA_SELECTION AND ${MediaStore.MediaColumns.VOLUME_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} = ?",
        if (relativePath == null) MEDIA_SELECTION_ARGS else MEDIA_SELECTION_ARGS + arrayOf(volumeName!!, relativePath),
        "${MediaStore.MediaColumns.DATE_MODIFIED} ASC, ${MediaStore.MediaColumns._ID} ASC",
      )?.use { cursor ->
        val idColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
        val volumeColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.VOLUME_NAME)
        val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
        val sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
        val modifiedColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_MODIFIED)
        val createdColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
        val mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
        val pathColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.RELATIVE_PATH)
        val bucketColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.BUCKET_DISPLAY_NAME)

        while (cursor.moveToNext()) {
          val id = cursor.getLong(idColumn)
          val volumeName = cursor.getString(volumeColumn)
          val item = MediaStoreItem(
            providerId = "$volumeName:$id",
            volumeName = volumeName,
            localUri = ContentUris.withAppendedId(
              MediaStore.Files.getContentUri(volumeName),
              id,
            ).toString(),
            displayName = cursor.getString(nameColumn).orEmpty(),
            byteCount = cursor.getLong(sizeColumn),
            modifiedAtEpochSeconds = cursor.nullableLong(modifiedColumn),
            mimeType = cursor.getString(mimeColumn),
            relativePath = cursor.getString(pathColumn),
            bucketDisplayName = cursor.getString(bucketColumn),
            createdAtEpochSeconds = cursor.nullableLong(createdColumn),
          )
          add(item)
        }
      }
    }

  }

  private fun android.database.Cursor.nullableLong(column: Int): Long? =
    if (isNull(column)) null else getLong(column)

  private companion object {
    val PROJECTION = arrayOf(
      MediaStore.MediaColumns._ID,
      MediaStore.MediaColumns.VOLUME_NAME,
      MediaStore.MediaColumns.DISPLAY_NAME,
      MediaStore.MediaColumns.SIZE,
      MediaStore.MediaColumns.DATE_MODIFIED,
      MediaStore.MediaColumns.DATE_ADDED,
      MediaStore.MediaColumns.MIME_TYPE,
      MediaStore.MediaColumns.RELATIVE_PATH,
      MediaStore.MediaColumns.BUCKET_DISPLAY_NAME,
    )
    const val MEDIA_SELECTION =
      "${MediaStore.Files.FileColumns.MEDIA_TYPE} IN (?, ?, ?)"
    val MEDIA_SELECTION_ARGS = arrayOf(
      MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString(),
      MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString(),
      MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO.toString(),
    )
  }
}

fun currentMediaPermissionAccess(context: Context): MediaPermissionAccess {
  fun granted(permission: String) =
    context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

  return mediaPermissionAccess(Build.VERSION.SDK_INT, ::granted)
}

fun mediaPermissionAccess(
  sdkInt: Int,
  granted: (String) -> Boolean,
): MediaPermissionAccess {
  return when {
    sdkInt >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> {
      val fullTypes = listOf(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
        Manifest.permission.READ_MEDIA_AUDIO,
      ).count { permission -> granted(permission) }
      when {
        fullTypes == 3 -> MediaPermissionAccess.FULL
        fullTypes > 0 || granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) ->
          MediaPermissionAccess.PARTIAL
        else -> MediaPermissionAccess.DENIED
      }
    }
    sdkInt >= Build.VERSION_CODES.TIRAMISU -> {
      val grantedTypes = listOf(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
        Manifest.permission.READ_MEDIA_AUDIO,
      ).count { permission -> granted(permission) }
      when {
        grantedTypes == 3 -> MediaPermissionAccess.FULL
        grantedTypes > 0 -> MediaPermissionAccess.PARTIAL
        else -> MediaPermissionAccess.DENIED
      }
    }
    granted(Manifest.permission.READ_EXTERNAL_STORAGE) -> MediaPermissionAccess.FULL
    else -> MediaPermissionAccess.DENIED
  }
}
