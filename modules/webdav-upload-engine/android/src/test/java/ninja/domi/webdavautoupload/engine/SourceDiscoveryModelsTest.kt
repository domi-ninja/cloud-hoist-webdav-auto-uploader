package ninja.domi.webdavautoupload.engine

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
    assertEquals(
      SourcePreview(2, 2_048, MediaPermissionAccess.PARTIAL),
      listOf(valid, valid).toSourcePreview(MediaPermissionAccess.PARTIAL),
    )
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
