package ninja.domi.cloudhoist.engine

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidMediaStoreDiscoveryTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()
  private val insertedUris = mutableListOf<Uri>()

  @After
  fun removeFixtures() {
    insertedUris.forEach { context.contentResolver.delete(it, null, null) }
  }

  @Test
  fun discoversCameraAndScreenshotsFromMediaStoreWithoutReadingBodies() {
    val cameraName = "camera-fixture-${System.nanoTime()}.jpg"
    insertImage("Camera", cameraName, 7)
    insertImage("Screenshots", "screenshot-fixture-${System.nanoTime()}.png", 11)
    insertImage("Pictures", "other-fixture-${System.nanoTime()}.jpg", 13)
    val discovery = AndroidMediaStoreDiscovery(
      context,
      permissionAccess = { MediaPermissionAccess.PARTIAL },
    )

    val camera = discovery.discover(MediaPreset.CAMERA)
    val screenshots = discovery.discover(MediaPreset.SCREENSHOTS)

    val cameraFixture = camera.files.single { it.fileName == cameraName }
    assertEquals(7L, cameraFixture.byteCount)
    assertEquals("image/jpeg", cameraFixture.mimeType)
    assertTrue(cameraFixture.createdAtEpochSeconds != null)
    assertTrue(
      screenshots.files.any {
        it.fileName.startsWith("screenshot-fixture-") && it.byteCount == 11L
      },
    )
    assertTrue(camera.files.none { it.fileName.startsWith("other-fixture-") })
    assertEquals(MediaPermissionAccess.PARTIAL, camera.preview.permissionAccess)
  }

  @Test
  fun discoversArbitraryFoldersAndReadsOnlyTheSelectedDirectory() {
    val directory = "CloudHoistFolderTest-${System.nanoTime()}"
    insertImage(directory, "first.jpg", 7)
    insertImage(directory, "second.jpg", 11)
    val discovery = AndroidMediaStoreDiscovery(context, permissionAccess = { MediaPermissionAccess.PARTIAL })
    val folder = discovery.folders().single { it.relativePath == "Pictures/$directory/" }
    assertEquals(2, folder.fileCount)
    assertEquals(18L, folder.totalBytes)
    val selected = discovery.discoverFolder(folder.volumeName, folder.relativePath)
    assertEquals(setOf("first.jpg", "second.jpg"), selected.files.map { it.fileName }.toSet())
    val restored = mediaFolderSelection(mediaFolderUri(folder.volumeName, folder.relativePath))
    assertEquals(SourceType.MEDIA_FOLDER, restored.type)
    assertEquals(folder.relativePath, restored.relativePath)
    assertEquals(folder.volumeName, restored.volumeName)
  }

  private fun insertImage(directory: String, name: String, byteCount: Int) {
    val values = ContentValues().apply {
      put(MediaStore.Images.Media.DISPLAY_NAME, name)
      put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
      put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/$directory")
      put(MediaStore.Images.Media.IS_PENDING, 1)
    }
    val uri = checkNotNull(
      context.contentResolver.insert(
        MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
        values,
      ),
    )
    insertedUris += uri
    context.contentResolver.openOutputStream(uri)!!.use { output ->
      output.write(ByteArray(byteCount) { it.toByte() })
    }
    context.contentResolver.update(
      uri,
      ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) },
      null,
      null,
    )
  }
}
