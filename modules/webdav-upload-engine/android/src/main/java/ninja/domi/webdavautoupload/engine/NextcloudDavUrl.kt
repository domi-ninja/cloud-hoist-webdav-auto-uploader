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

  private fun base(account: StoredAccount) = account.serverUrl.toHttpUrl().newBuilder()
    .addPathSegments("remote.php/dav/files")
    .addPathSegment(account.davUserId)
}
