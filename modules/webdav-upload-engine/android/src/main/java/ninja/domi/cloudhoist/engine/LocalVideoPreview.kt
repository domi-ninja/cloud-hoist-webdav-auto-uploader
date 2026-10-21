package ninja.domi.cloudhoist.engine

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Base64
import android.util.Size
import java.io.ByteArrayOutputStream
import java.util.concurrent.Semaphore

/** Decode a small frame with Android's installed codecs. Unsupported videos keep their file icon. */
object LocalVideoPreview {
  private val permits = Semaphore(2)
  fun thumbnail(context: Context, value: String): String? {
    val uri = Uri.parse(value)
    require(uri.scheme == "content" || uri.scheme == "file")
    permits.acquire()
    try {
      val frame = runCatching { context.contentResolver.loadThumbnail(uri, Size(320, 320), null) }.getOrNull()
        ?: runCatching {
          MediaMetadataRetriever().use { retriever ->
            retriever.setDataSource(context, uri)
            retriever.getScaledFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, 320, 320)
          }
        }.getOrNull() ?: return null
      return try {
        val bytes = ByteArrayOutputStream()
        frame.compress(Bitmap.CompressFormat.JPEG, 80, bytes)
        "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
      } finally { frame.recycle() }
    } finally { permits.release() }
  }
}
