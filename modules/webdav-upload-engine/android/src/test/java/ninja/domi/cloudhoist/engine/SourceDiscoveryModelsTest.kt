package ninja.domi.cloudhoist.engine

import android.Manifest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SourceDiscoveryModelsTest {
  @Test
  fun classifiesCameraAndKeepsItsDestinationFlat() {
    val item = item(relativePath = "DCIM/Camera/")

    assertEquals(
      DiscoveredFile(
        providerId = "image:42",
        localUri = "content://media/external/images/media/42",
        fileName = "IMG_0042.jpg",
        relativePathSegments = emptyList(),
        byteCount = 1_024,
        modifiedAtEpochSeconds = 123,
        mimeType = "image/jpeg",
      ),
      item.forPreset(MediaPreset.CAMERA),
    )
    assertNull(item.forPreset(MediaPreset.SCREENSHOTS))
  }

  @Test
  fun usesBucketWhenProviderOmitsRelativePath() {
    val item = item(relativePath = null, bucketDisplayName = "Screenshots")

    assertEquals("IMG_0042.jpg", item.forPreset(MediaPreset.SCREENSHOTS)?.fileName)
  }

  @Test
  fun doesNotMatchParentDirectoryNames() {
    val item = item(relativePath = "Pictures/Screenshots/Edited/")

    assertNull(item.forPreset(MediaPreset.SCREENSHOTS))
  }

  @Test
  fun representsMissingTimestampsWithoutReadingFileContents() {
    val discovered = item(modifiedAt = null).forPreset(MediaPreset.CAMERA)

    assertEquals(0L, discovered?.modifiedAtEpochSeconds)
  }

  @Test
  fun rejectsInvalidRowsAndBuildsPreview() {
    val valid = item().forPreset(MediaPreset.CAMERA)!!

    assertNull(item(displayName = "").forPreset(MediaPreset.CAMERA))
    assertNull(item(byteCount = -1).forPreset(MediaPreset.CAMERA))
    val preview = listOf(valid, valid).toSourcePreview(MediaPermissionAccess.PARTIAL)
    assertEquals(2, preview.eligibleFileCount)
    assertEquals(2_048, preview.totalBytes)
    assertEquals(MediaPermissionAccess.PARTIAL, preview.permissionAccess)
    assertEquals(listOf(valid.localUri, valid.localUri), preview.files.map { it.localUri })
  }

  @Test
  fun pagesThroughAllPreviewFilesWithoutChangingTotals() {
    val files = (0 until 85).map { index ->
      item(displayName = "photo-$index.jpg").forPreset(MediaPreset.CAMERA)!!
    }
    val pages = listOf(0, 40, 80).map { files.toSourcePreview(offset = it, pageSize = 40) }
    assertEquals(listOf(40, 80, null), pages.map { it.nextOffset })
    assertEquals(files.map { it.fileName }, pages.flatMap { it.files }.map { it.fileName })
    pages.forEach { assertEquals(85, it.eligibleFileCount) }
  }

  @Test
  fun mapsEverySupportedAndroidMediaPermissionBranch() {
    fun access(sdk: Int, vararg permissions: String) = mediaPermissionAccess(
      sdk,
      permissions.toSet()::contains,
    )

    assertEquals(
      MediaPermissionAccess.FULL,
      access(32, Manifest.permission.READ_EXTERNAL_STORAGE),
    )
    assertEquals(MediaPermissionAccess.DENIED, access(32))
    assertEquals(
      MediaPermissionAccess.PARTIAL,
      access(33, Manifest.permission.READ_MEDIA_IMAGES),
    )
    assertEquals(
      MediaPermissionAccess.FULL,
      access(
        33,
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
        Manifest.permission.READ_MEDIA_AUDIO,
      ),
    )
    assertEquals(
      MediaPermissionAccess.PARTIAL,
      access(34, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED),
    )
    assertEquals(MediaPermissionAccess.DENIED, access(34))
  }

  private fun item(
    displayName: String = "IMG_0042.jpg",
    byteCount: Long = 1_024,
    modifiedAt: Long? = 123,
    relativePath: String? = "DCIM/Camera/",
    bucketDisplayName: String? = "Camera",
  ) = MediaStoreItem(
    providerId = "image:42",
    localUri = "content://media/external/images/media/42",
    displayName = displayName,
    byteCount = byteCount,
    modifiedAtEpochSeconds = modifiedAt,
    mimeType = "image/jpeg",
    relativePath = relativePath,
    bucketDisplayName = bucketDisplayName,
  )
}
