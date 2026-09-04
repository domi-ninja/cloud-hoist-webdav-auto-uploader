package ninja.domi.webdavautoupload.engine

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import java.time.Instant

/** Debug-APK-only entry point for opaque host-driven live account checks. */
class DebugAccountAcceptanceProvider : ContentProvider() {
  override fun onCreate() = true

  override fun call(method: String, arg: String?, extras: Bundle?): Bundle = try {
    when (method) {
      "connect" -> connect(requireNotNull(extras))
      "verify" -> verify(requireNotNull(extras))
      "prepareUpload" -> prepareUpload(requireNotNull(extras))
      "seedAndUpload" -> seedAndUpload(requireNotNull(extras))
      "cleanupMedia" -> cleanupMedia(requireNotNull(extras))
      "seed" -> seed()
      "clear" -> clear()
      else -> result("error", "ERR_ACCEPTANCE_UNKNOWN_METHOD")
    }
  } catch (error: DebugUploadAcceptanceException) {
    result("error", error.acceptanceCode)
  } catch (error: CodedException) {
    result("error", error.code)
  } catch (_: Exception) {
    result("error", "ERR_ACCEPTANCE_FAILURE")
  }

  private fun connect(extras: Bundle): Bundle {
    val repository = repository()
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
      repository(),
      decode(extras, "serverUrlB64"),
      decode(extras, "serverAddressB64"),
    ).verifyStoredAccount()
    return result("ok")
  }

  private fun prepareUpload(extras: Bundle): Bundle {
    uploadAcceptance(extras).prepare(decode(extras, "runFolderB64"))
    return result("ok")
  }

  private fun seedAndUpload(extras: Bundle): Bundle {
    val upload = uploadAcceptance(extras).seedAndUpload(decode(extras, "runFolderB64"))
    return result("ok").apply {
      putString("smallName", upload.smallName)
      putString("smallSha256", upload.smallSha256)
      putString("largeName", upload.largeName)
      putString("largeSha256", upload.largeSha256)
      putInt("completedJobs", upload.completedJobs)
      putInt("directUploads", upload.directUploads)
      putInt("chunkedUploads", upload.chunkedUploads)
      putBoolean("chunkingExpected", upload.chunkingExpected)
    }
  }

  private fun cleanupMedia(extras: Bundle): Bundle {
    uploadAcceptance(extras).cleanupMedia(decode(extras, "runFolderB64"))
    return result("ok")
  }

  /** Creates non-networked account state so emulator UI tests can reach source setup. */
  private fun seed(): Bundle {
    repository().save(
      StoredAccountCredential(
        account = StoredAccount(
          id = "5e6f70aa-4ba2-4d1d-a084-e8917c417d31",
          serverUrl = "https://acceptance.invalid",
          loginName = "acceptance",
          davUserId = "acceptance",
          displayName = "Emulator acceptance",
          checkedAt = Instant.EPOCH.toString(),
          capabilities = AccountCapabilities(
            serverVersion = "acceptance",
            chunkingSupported = false,
            maxChunkSize = null,
          ),
        ),
        appPassword = "not-a-real-secret",
      ),
    )
    return result("ok")
  }

  private fun clear(): Bundle {
    repository().clear()
    return result("ok")
  }

  private fun repository(): AndroidAccountRepository {
    val providerContext = requireNotNull(context)
    return AndroidAccountRepository(
      providerContext,
      EngineRoomDatabase.open(providerContext).engineDao(),
    )
  }

  private fun manager(
    repository: AccountRepository,
    serverUrl: String,
    serverAddress: String,
  ) = AccountManager(
    repository = repository,
    networkClient = NextcloudClient(acceptanceDns(serverUrl, serverAddress)),
    onAccountChanged = {},
  )

  private fun uploadAcceptance(extras: Bundle) = DebugUploadAcceptance(
    context = requireNotNull(context),
    serverUrl = decode(extras, "serverUrlB64"),
    serverAddress = decode(extras, "serverAddressB64"),
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
