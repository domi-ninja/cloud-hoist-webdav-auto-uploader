package ninja.domi.webdavautoupload.engine

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
    insertImage("Camera", "camera-fixture-${System.nanoTime()}.jpg", 7)
    insertImage("Screenshots", "screenshot-fixture-${System.nanoTime()}.png", 11)
    insertImage("Pictures", "other-fixture-${System.nanoTime()}.jpg", 13)
    val discovery = AndroidMediaStoreDiscovery(
      context,
      permissionAccess = { MediaPermissionAccess.PARTIAL },
    )

    val camera = discovery.discover(MediaPreset.CAMERA)
    val screenshots = discovery.discover(MediaPreset.SCREENSHOTS)

    assertTrue(camera.files.any { it.fileName.startsWith("camera-fixture-") && it.byteCount == 7L })
    assertTrue(
      screenshots.files.any {
        it.fileName.startsWith("screenshot-fixture-") && it.byteCount == 11L
      },
    )
    assertTrue(camera.files.none { it.fileName.startsWith("other-fixture-") })
    assertEquals(MediaPermissionAccess.PARTIAL, camera.preview.permissionAccess)
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
