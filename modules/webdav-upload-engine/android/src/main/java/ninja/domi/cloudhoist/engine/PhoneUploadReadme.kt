package ninja.domi.cloudhoist.engine

import android.content.Context
import java.time.Instant
import okhttp3.Credentials
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

internal fun phoneUploadReadme(lastUpload: Instant?): String = """
Cloud Hoist phone uploads

Cloud Hoist uploads the phone folders you selected to this Nextcloud folder.
Subfolders follow the folder names on your phone. Your original files stay on the phone.
Changes to phone files update their uploaded copies. Deleting a file on the phone does not delete its uploaded copy.
Manage backup folders and pause or resume uploads in the Cloud Hoist app.

Last completed upload (UTC): ${lastUpload ?: "No uploads completed yet"}
This timestamp updates after syncing finishes. This file is maintained by Cloud Hoist.
""".trimIndent() + "\n"

/** Metadata failure retries separately without changing the successfully uploaded media. */
class PhoneUploadReadme(private val http: OkHttpClient = OkHttpClient()) {
  fun write(credential: StoredAccountCredential, lastUpload: Instant?, onlyIfMissing: Boolean = false) {
    val url = NextcloudDavUrl.file(credential.account, listOf("Phone Uploads"), "Read me - Cloud Hoist.txt")
    val request = Request.Builder().url(url)
      .header("Authorization", Credentials.basic(credential.account.loginName, credential.appPassword, Charsets.UTF_8))
      .apply { if (onlyIfMissing) header("If-None-Match", "*") }
      .put(phoneUploadReadme(lastUpload).toRequestBody("text/plain; charset=utf-8".toMediaType())).build()
    http.newCall(request).execute().use { response ->
      check(response.isSuccessful || (onlyIfMissing && response.code == 412)) { "Upload information could not be updated (${response.code})." }
    }
  }

  fun updateAfterSync(context: Context, dao: EngineDao, credential: StoredAccountCredential): Boolean {
    if (dao.pendingWorkCount() > 0) return true
    val completed = dao.latestCompletedUploadInPhoneUploads() ?: return true
    val preferences = context.getSharedPreferences("phone_upload_readme", Context.MODE_PRIVATE)
    val key = credential.account.id + ":" + credential.account.serverUrl
    if (preferences.getLong(key, 0) >= completed) return true
    return runCatching {
      write(credential, Instant.ofEpochMilli(completed))
      preferences.edit().putLong(key, completed).commit()
    }.getOrDefault(false)
  }
}
