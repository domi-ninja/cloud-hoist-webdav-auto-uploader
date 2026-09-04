package ninja.domi.webdavautoupload.engine

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.provider.DocumentsContract.Document

class FixtureDocumentsProvider : ContentProvider() {
  override fun onCreate() = true

  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?,
  ): Cursor {
    val documentIndex = uri.pathSegments.indexOf("document")
    require(documentIndex >= 0 && documentIndex + 1 < uri.pathSegments.size)
    val documentId = uri.pathSegments[documentIndex + 1]
    val nodes = if (uri.lastPathSegment == "children") {
      when (documentId) {
        "root" -> listOf(node("trips"), node("root-note"))
        "trips" -> listOf(node("2026"))
        "2026" -> listOf(node("photo"), node("metadata"))
        else -> emptyList()
      }
    } else {
      listOf(node(documentId))
    }
    return rows(projection ?: DOCUMENT_COLUMNS, nodes)
  }

  override fun getType(uri: Uri): String? = null

  override fun insert(uri: Uri, values: ContentValues?): Uri? =
    throw UnsupportedOperationException()

  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int =
    throw UnsupportedOperationException()

  override fun update(
    uri: Uri,
    values: ContentValues?,
    selection: String?,
    selectionArgs: Array<out String>?,
  ): Int = throw UnsupportedOperationException()

  private fun node(id: String): Map<String, Any?> = when (id) {
    "root" -> document(id, "Fixture", Document.MIME_TYPE_DIR)
    "trips" -> document(id, "Trips", Document.MIME_TYPE_DIR)
    "2026" -> document(id, "2026", Document.MIME_TYPE_DIR)
    "photo" -> document(id, "lake.jpg", "image/jpeg", 42L, 4_000L)
    "metadata" -> document(id, ".nomedia", "application/octet-stream", 1L, 1_000L)
    "root-note" -> document(id, ".upload-me", "text/plain", null, null)
    else -> throw java.io.FileNotFoundException(id)
  }

  private fun document(
    id: String,
    name: String,
    mimeType: String,
    size: Long? = null,
    modified: Long? = null,
  ) = mapOf(
    Document.COLUMN_DOCUMENT_ID to id,
    Document.COLUMN_DISPLAY_NAME to name,
    Document.COLUMN_MIME_TYPE to mimeType,
    Document.COLUMN_SIZE to size,
    Document.COLUMN_LAST_MODIFIED to modified,
  )

  private fun rows(
    projection: Array<out String>,
    values: List<Map<String, Any?>>,
  ) = MatrixCursor(projection).apply {
    values.forEach { value -> addRow(projection.map(value::get)) }
  }

  private companion object {
    val DOCUMENT_COLUMNS = arrayOf(
      Document.COLUMN_DOCUMENT_ID,
      Document.COLUMN_DISPLAY_NAME,
      Document.COLUMN_MIME_TYPE,
      Document.COLUMN_SIZE,
      Document.COLUMN_LAST_MODIFIED,
    )
  }
}
