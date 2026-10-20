package ninja.domi.cloudhoist.engine

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable

data class DocumentTreePickerInput(
  val initialUri: String? = null,
) : Serializable

sealed interface DocumentTreePickerResult {
  data object Cancelled : DocumentTreePickerResult

  data class Selected(
    val treeUri: String,
    val resultFlags: Int,
  ) : DocumentTreePickerResult
}

class DocumentTreePickerContract :
  AppContextActivityResultContract<DocumentTreePickerInput, DocumentTreePickerResult> {
  override fun createIntent(context: Context, input: DocumentTreePickerInput) =
    Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
      addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
          Intent.FLAG_GRANT_PREFIX_URI_PERMISSION,
      )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && input.initialUri != null) {
        putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse(input.initialUri))
      }
    }

  override fun parseResult(
    input: DocumentTreePickerInput,
    resultCode: Int,
    intent: Intent?,
  ): DocumentTreePickerResult {
    val uri = intent?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      return DocumentTreePickerResult.Cancelled
    }
    return DocumentTreePickerResult.Selected(uri.toString(), intent.flags)
  }
}
