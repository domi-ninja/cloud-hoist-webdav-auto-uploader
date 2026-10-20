package ninja.domi.cloudhoist.engine

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class NextcloudDavClientTest {
  @Test
  fun listsOnlyDirectChildCollectionsAndDecodesNames() {
    val client = fixtureClient(207, MULTISTATUS)
    val folders = client.listFolders(CREDENTIAL, listOf("Parent folder"))

    assertEquals(
      listOf(
        RemoteFolder("child #1", listOf("Parent folder", "child #1")),
        RemoteFolder("日本語", listOf("Parent folder", "日本語")),
      ),
      folders,
    )
  }

  @Test
  fun encodesEveryDavPathSegmentSeparately() {
    var requestedUrl = ""
    val client = NextcloudDavClient(
      OkHttpClient.Builder().addInterceptor { chain ->
        requestedUrl = chain.request().url.encodedPath
        response(chain.request(), 207, EMPTY_MULTISTATUS)
      }.build(),
    )

    client.listFolders(CREDENTIAL, listOf("space here", "hash#slash%"))

    assertEquals(
      "/nextcloud/remote.php/dav/files/dav%2Fuser/space%20here/hash%23slash%25/",
      requestedUrl,
    )
  }

  @Test
  fun treatsExistingFolderAsCreateSuccessAndClassifiesFailures() {
    assertEquals(
      RemoteFolder("Existing", listOf("Existing")),
      fixtureClient(405).createFolder(CREDENTIAL, emptyList(), "Existing"),
    )
    assertThrows(DavPermissionException::class.java) {
      fixtureClient(403).listFolders(CREDENTIAL, emptyList())
    }
    assertThrows(DavQuotaException::class.java) {
      fixtureClient(507).createFolder(CREDENTIAL, emptyList(), "Full")
    }
  }

  @Test
  fun rejectsDoctypesAndMalformedXml() {
    assertThrows(AccountUnsupportedResponseException::class.java) {
      fixtureClient(207, "<!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><foo>&xxe;</foo>")
        .listFolders(CREDENTIAL, emptyList())
    }
  }

  private fun fixtureClient(code: Int, body: String = "") = NextcloudDavClient(
    OkHttpClient.Builder().addInterceptor { chain ->
      response(chain.request(), code, body)
    }.build(),
  )

  private fun response(request: Request, code: Int, body: String) = Response.Builder()
    .request(request)
    .protocol(Protocol.HTTP_1_1)
    .code(code)
    .message("fixture")
    .body(body.toResponseBody("application/xml".toMediaType()))
    .build()

  private companion object {
    val CREDENTIAL = StoredAccountCredential(
      StoredAccount(
        id = "account-1",
        serverUrl = "https://cloud.example.test/nextcloud",
        loginName = "login",
        davUserId = "dav/user",
        displayName = "Domi",
        checkedAt = "2026-09-04T12:00:00Z",
        capabilities = AccountCapabilities("34.0.0", true, null),
      ),
      "secret",
    )
    const val EMPTY_MULTISTATUS = """<d:multistatus xmlns:d="DAV:"/>"""
    const val MULTISTATUS = """
      <d:multistatus xmlns:d="DAV:">
        <d:response><d:href>/nextcloud/remote.php/dav/files/dav%2Fuser/Parent%20folder/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
        <d:response><d:href>/nextcloud/remote.php/dav/files/dav%2Fuser/Parent%20folder/child%20%231/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
        <d:response><d:href>/nextcloud/remote.php/dav/files/dav%2Fuser/Parent%20folder/%E6%97%A5%E6%9C%AC%E8%AA%9E/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
        <d:response><d:href>/nextcloud/remote.php/dav/files/dav%2Fuser/Parent%20folder/file.txt</d:href><d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat></d:response>
        <d:response><d:href>/nextcloud/remote.php/dav/files/dav%2Fuser/Parent%20folder/child/deep/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
      </d:multistatus>
    """
  }
}
