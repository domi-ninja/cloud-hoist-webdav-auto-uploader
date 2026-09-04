package ninja.domi.webdavautoupload.engine

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import java.net.InetAddress
import java.net.URI
import okhttp3.Dns

/** Debug-APK-only entry point for opaque host-driven live account checks. */
class DebugAccountAcceptanceProvider : ContentProvider() {
  override fun onCreate() = true

  override fun call(method: String, arg: String?, extras: Bundle?): Bundle = try {
    when (method) {
      "connect" -> connect(requireNotNull(extras))
      "verify" -> verify(requireNotNull(extras))
      else -> result("error", "ERR_ACCEPTANCE_UNKNOWN_METHOD")
    }
  } catch (error: CodedException) {
    result("error", error.code)
  } catch (_: Exception) {
    result("error", "ERR_ACCEPTANCE_FAILURE")
  }

  private fun connect(extras: Bundle): Bundle {
    val repository = AndroidAccountRepository(requireNotNull(context))
    val serverUrl = decode(extras, "serverUrlB64")
    repository.clear()
    manager(repository, serverUrl, decode(extras, "serverAddressB64")).connectManual(
      serverUrl = serverUrl,
      username = decode(extras, "usernameB64"),
      appPassword = decode(extras, "appPasswordB64"),
    )
    return result("ok")
  }

  private fun verify(extras: Bundle): Bundle {
    manager(
      AndroidAccountRepository(requireNotNull(context)),
      decode(extras, "serverUrlB64"),
      decode(extras, "serverAddressB64"),
    ).verifyStoredAccount()
    return result("ok")
  }

  private fun manager(
    repository: AccountRepository,
    serverUrl: String,
    serverAddress: String,
  ) = AccountManager(
    repository = repository,
    networkClient = NextcloudClient(object : Dns {
      override fun lookup(hostname: String): List<InetAddress> =
        if (hostname.equals(URI(serverUrl).host, ignoreCase = true)) {
          listOf(InetAddress.getByName(serverAddress))
        } else {
          Dns.SYSTEM.lookup(hostname)
        }
      }
    ),
    onAccountChanged = {},
  )

  private fun decode(extras: Bundle, key: String): String =
    Base64.decode(
      requireNotNull(extras.getString(key)),
      Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP,
    ).toString(Charsets.UTF_8)

  private fun result(status: String, code: String? = null) = Bundle().apply {
    putString("status", status)
    code?.let { putString("code", it) }
  }

  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?,
  ): Cursor? = null

  override fun getType(uri: Uri): String? = null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(
    uri: Uri,
    values: ContentValues?,
    selection: String?,
    selectionArgs: Array<out String>?,
  ): Int = 0
}
