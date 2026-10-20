package ninja.domi.cloudhoist.engine

import android.content.Context
import android.provider.DocumentsContract
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidDocumentTreeGatewayTest {
  @Test
  fun walksNestedDocumentsThroughAndroidContentResolver() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val treeUri = DocumentsContract.buildTreeDocumentUri(AUTHORITY, "root").toString()
    val gateway = AndroidDocumentTreeGateway(context, requirePersistedPermission = false)

    val files = DocumentTreeDiscovery(gateway).discover(treeUri)

    assertEquals(listOf(".upload-me", "lake.jpg"), files.map(DiscoveredFile::fileName))
    assertEquals(emptyList<String>(), files[0].relativePathSegments)
    assertEquals(listOf("Trips", "2026"), files[1].relativePathSegments)
    assertEquals(42L, files[1].byteCount)
  }

  private companion object {
    const val AUTHORITY = "ninja.domi.cloudhoist.engine.fixture-documents"
  }
}
