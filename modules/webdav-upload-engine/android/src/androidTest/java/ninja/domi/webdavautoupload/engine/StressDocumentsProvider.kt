package ninja.domi.webdavautoupload.engine

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.MediaStore

/** Exposes only this test run's real MediaStore photos as a persisted SAF tree. */
class StressDocumentsProvider : ContentProvider() {
  override fun onCreate() = true
  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
    val id = DocumentsContract.getDocumentId(uri)
    val run = id.substringBefore(':')
    require(run.matches(Regex("stress-[a-z0-9-]+")))
    val columns = projection ?: arrayOf("document_id", "_display_name", "mime_type", "_size", "last_modified")
    val result = MatrixCursor(columns)
    fun row(documentId: String, name: String, type: String, size: Long?, modified: Long?) {
      val values = mapOf<String, Any?>("document_id" to documentId, "_display_name" to name, "mime_type" to type, "_size" to size, "last_modified" to modified)
      result.addRow(columns.map(values::get))
    }
    if (uri.lastPathSegment != "children" && !id.contains(':')) {
      row(run, "Stress photos", DocumentsContract.Document.MIME_TYPE_DIR, null, null)
      return result
    }
    val mediaId = id.substringAfter(':', "")
    val where = if (mediaId.isEmpty()) "_display_name LIKE ?" else "_display_name LIKE ? AND _id = ?"
    val args = if (mediaId.isEmpty()) arrayOf("$run-%") else arrayOf("$run-%", mediaId)
    requireNotNull(context).contentResolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
      arrayOf("_id", "_display_name", "_size", "date_modified"), where, args, "_id ASC")?.use { cursor ->
      while (cursor.moveToNext()) row("$run:${cursor.getLong(0)}", cursor.getString(1), "image/jpeg", cursor.getLong(2), cursor.getLong(3) * 1000)
    }
    return result
  }
  override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor? {
    require(mode == "r")
    val id = DocumentsContract.getDocumentId(uri)
    query(uri, arrayOf("document_id"), null, null, null).use { require(it.count == 1) }
    return requireNotNull(context).contentResolver.openFileDescriptor(
      Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id.substringAfter(':')), "r")
  }
  override fun getType(uri: Uri) = "image/jpeg"
  override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException()
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = throw UnsupportedOperationException()
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = throw UnsupportedOperationException()
}
