package ninja.domi.webdavautoupload.engine

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
