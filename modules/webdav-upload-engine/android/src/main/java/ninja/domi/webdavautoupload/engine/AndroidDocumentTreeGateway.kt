package ninja.domi.webdavautoupload.engine

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.DocumentsContract

class AndroidDocumentTreeGateway(
  private val context: Context,
  private val requirePersistedPermission: Boolean = true,
) : DocumentTreeGateway {
  private val contentResolver: ContentResolver = context.contentResolver

  fun persistReadPermission(treeUri: String, resultFlags: Int) {
    if (resultFlags and Intent.FLAG_GRANT_READ_URI_PERMISSION == 0) {
      throw SourceAccessException(
        SourceAccessBlocker.PERMISSION_REVOKED,
        "The folder picker did not grant read access.",
      )
    }

    val uri = parseTreeUri(treeUri)
    try {
      contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )
    } catch (error: SecurityException) {
      throw SourceAccessException(
        SourceAccessBlocker.PERMISSION_REVOKED,
        "Android could not retain access to the selected folder.",
        error,
      )
    }
  }

  fun hasPersistedReadPermission(treeUri: String): Boolean {
    val uri = parseTreeUri(treeUri)
    return contentResolver.persistedUriPermissions.any { permission ->
      permission.uri == uri && permission.isReadPermission
    }
  }

  override fun root(treeUri: String): DocumentTreeNode {
    checkPermission(treeUri)
    val tree = parseTreeUri(treeUri)
    return queryNode(
      tree,
      DocumentsContract.buildDocumentUriUsingTree(
        tree,
        DocumentsContract.getTreeDocumentId(tree),
      ),
    )
  }

  override fun children(
    treeUri: String,
    directoryProviderId: String,
  ): List<DocumentTreeNode> {
    checkPermission(treeUri)
    val tree = parseTreeUri(treeUri)
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
      tree,
      directoryProviderId,
    )
    return query(childrenUri) { cursor -> node(tree, cursor) }
  }

  private fun queryNode(treeUri: Uri, documentUri: Uri): DocumentTreeNode =
    query(documentUri) { cursor -> node(treeUri, cursor) }.singleOrNull()
      ?: throw SourceAccessException(
        SourceAccessBlocker.FOLDER_UNAVAILABLE,
        "The selected folder is no longer available.",
      )

  private fun <T> query(uri: Uri, readRow: (Cursor) -> T): List<T> {
    try {
      val cursor = contentResolver.query(uri, PROJECTION, null, null, null)
        ?: throw SourceAccessException(
          SourceAccessBlocker.FOLDER_UNAVAILABLE,
          "The selected storage provider is unavailable.",
        )
      return cursor.use {
        buildList {
          while (it.moveToNext()) add(readRow(it))
        }
      }
    } catch (error: SecurityException) {
      throw SourceAccessException(
        SourceAccessBlocker.PERMISSION_REVOKED,
        "Access to the selected folder was revoked.",
        error,
      )
    } catch (error: IllegalArgumentException) {
      throw SourceAccessException(
        SourceAccessBlocker.FOLDER_UNAVAILABLE,
        "The selected storage provider is unavailable.",
        error,
      )
    }
  }

  private fun node(treeUri: Uri, cursor: Cursor): DocumentTreeNode {
    val providerId = cursor.string(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
    val mimeType = cursor.nullableString(DocumentsContract.Document.COLUMN_MIME_TYPE)
    return DocumentTreeNode(
      providerId = providerId,
      displayName = cursor.nullableString(DocumentsContract.Document.COLUMN_DISPLAY_NAME).orEmpty(),
      localUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, providerId).toString(),
      isDirectory = mimeType == DocumentsContract.Document.MIME_TYPE_DIR,
      isReadable = true,
      byteCount = cursor.nullableLong(DocumentsContract.Document.COLUMN_SIZE),
      modifiedAtEpochMillis = cursor.nullableLong(
        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
      ),
      mimeType = mimeType?.takeUnless { it == DocumentsContract.Document.MIME_TYPE_DIR },
    )
  }

  private fun checkPermission(treeUri: String) {
    if (requirePersistedPermission && !hasPersistedReadPermission(treeUri)) {
      throw SourceAccessException(
        SourceAccessBlocker.PERMISSION_REVOKED,
        "Access to the selected folder was revoked.",
      )
    }
  }

  private fun parseTreeUri(value: String): Uri {
    val uri = Uri.parse(value)
    try {
      DocumentsContract.getTreeDocumentId(uri)
    } catch (error: IllegalArgumentException) {
      throw SourceAccessException(
        SourceAccessBlocker.FOLDER_UNAVAILABLE,
        "The selected folder URI is invalid.",
        error,
      )
    }
    return uri
  }

  private fun Cursor.string(columnName: String): String =
    getString(getColumnIndexOrThrow(columnName))

  private fun Cursor.nullableString(columnName: String): String? {
    val column = getColumnIndexOrThrow(columnName)
    return if (isNull(column)) null else getString(column)
  }

  private fun Cursor.nullableLong(columnName: String): Long? {
    val column = getColumnIndexOrThrow(columnName)
    return if (isNull(column)) null else getLong(column)
  }

  private companion object {
    val PROJECTION = arrayOf(
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      DocumentsContract.Document.COLUMN_SIZE,
      DocumentsContract.Document.COLUMN_LAST_MODIFIED,
    )
  }
}
