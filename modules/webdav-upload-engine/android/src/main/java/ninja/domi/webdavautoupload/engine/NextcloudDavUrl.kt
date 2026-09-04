package ninja.domi.webdavautoupload.engine

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl

object NextcloudDavUrl {
  fun folder(account: StoredAccount, pathSegments: List<String>): HttpUrl =
    base(account)
      .apply { pathSegments.forEach(::addPathSegment) }
      .addPathSegment("")
      .build()

  fun file(account: StoredAccount, pathSegments: List<String>, fileName: String): HttpUrl =
    base(account)
      .apply { pathSegments.forEach(::addPathSegment) }
      .addPathSegment(fileName)
      .build()

  fun uploadFolder(account: StoredAccount, uploadId: String): HttpUrl =
    uploadBase(account, uploadId).addPathSegment("").build()

  fun uploadChunk(account: StoredAccount, uploadId: String, chunkName: String): HttpUrl =
    uploadBase(account, uploadId).addPathSegment(chunkName).build()

  fun uploadAssembly(account: StoredAccount, uploadId: String): HttpUrl =
    uploadBase(account, uploadId).addPathSegment(".file").build()

  private fun base(account: StoredAccount) = account.serverUrl.toHttpUrl().newBuilder()
    .addPathSegments("remote.php/dav/files")
    .addPathSegment(account.davUserId)

  private fun uploadBase(account: StoredAccount, uploadId: String) =
    account.serverUrl.toHttpUrl().newBuilder()
      .addPathSegments("remote.php/dav/uploads")
      .addPathSegment(account.davUserId)
      .addPathSegment(uploadId)
}
