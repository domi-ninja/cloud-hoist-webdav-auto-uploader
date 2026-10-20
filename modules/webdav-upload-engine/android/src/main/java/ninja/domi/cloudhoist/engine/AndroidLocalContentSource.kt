package ninja.domi.cloudhoist.engine

import android.content.ContentResolver
import android.net.Uri

class AndroidLocalContentSource(
  private val contentResolver: ContentResolver,
) : LocalContentSource {
  override fun open(uri: String) = try {
    contentResolver.openInputStream(Uri.parse(uri))
  } catch (_: Exception) {
    null
  }
}
