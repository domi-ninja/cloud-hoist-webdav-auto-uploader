package ninja.domi.cloudhoist.engine

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FileInventoryTest {
  @Test
  fun doesNotPresentAnInFlightStagingObjectAsAnotherPhoto() {
    val entries = reconcileInventory(source(), emptyList(), listOf(
      RemoteInventoryFile("photo.jpg", "image/jpeg", 10, 1),
      RemoteInventoryFile(".keep-me.jpg", "image/jpeg", 10, 1),
      RemoteInventoryFile(".photo.jpg.cloud-hoist-01838989-173a-436a-94dd-9377d3db7a25", "image/jpeg", 10, 1),
    ))
    assertEquals(listOf("photo.jpg", ".keep-me.jpg"), entries.map { it["fileName"] })
  }

  @Test
  fun reconcilesLocalRemoteAndSharedFiles() {
    val source = source()
    val local = listOf(
      local("local.jpg", "queued"),
      local("both.jpg", "completed", completedAt = 3_000),
    )
    val remote = listOf(
      RemoteInventoryFile("both.jpg", "image/jpeg", 20, 2_000),
      RemoteInventoryFile("remote.jpg", "image/jpeg", 30, 4_000),
    )

    val entries = reconcileInventory(source, local, remote).associateBy {
      it["relativePath"]
    }

    assertEquals("local_only", entries["local.jpg"]?.get("presence"))
    assertEquals("both", entries["both.jpg"]?.get("presence"))
    assertEquals("remote_only", entries["remote.jpg"]?.get("presence"))
    assertEquals("queued", (entries["local.jpg"]?.get("transfer") as Map<*, *>)["status"])
    assertEquals("/Photos/remote.jpg", entries["remote.jpg"]?.get("remotePath"))
  }

  @Test
  fun usesTheUploadedKeepBothNameForMatching() {
    val entries = reconcileInventory(
      source(),
      listOf(local("photo.jpg", "completed", remoteName = "photo (1).jpg")),
      listOf(RemoteInventoryFile("photo (1).jpg", "image/jpeg", 10, 2_000)),
    )

    assertEquals(1, entries.size)
    assertEquals("both", entries.single()["presence"])
    assertEquals("photo (1).jpg", entries.single()["fileName"])
  }

  @Test
  fun pagesTwentyItemsWithoutLosingErrors() {
    val items = List(45) { mapOf<String, Any?>("relativePath" to "$it.jpg") }
    val error = InventoryError("source", "offline")

    val first = inventoryPage(items, listOf(error), 0, 20)
    val last = inventoryPage(items, listOf(error), 40, 20)

    assertEquals(20, first.items.size)
    assertEquals(20, first.nextOffset)
    assertEquals(listOf(error), first.errors)
    assertEquals(5, last.items.size)
    assertNull(last.nextOffset)
  }

  @Test
  fun filtersBeforePagination() {
    val items = List(45) { index ->
      mapOf<String, Any?>(
        "sourceId" to if (index % 2 == 0) "camera" else "screenshots",
        "transfer" to mapOf("status" to if (index >= 40) "failed" else "uploaded"),
      )
    }

    val failed = inventoryPage(
      items,
      emptyList(),
      offset = 0,
      pageSize = 20,
      filter = InventoryFilter(status = "failed"),
    )
    val camera = inventoryPage(
      items,
      emptyList(),
      offset = 0,
      pageSize = 20,
      filter = InventoryFilter(sourceId = "camera"),
    )

    assertEquals(5, failed.items.size)
    assertNull(failed.nextOffset)
    assertEquals(20, camera.items.size)
    assertEquals(20, camera.nextOffset)
  }

  @Test
  fun decodesImmediateWebDavChildrenAndMetadata() {
    val xml = """
      <d:multistatus xmlns:d="DAV:">
        <d:response><d:href>/nextcloud/remote.php/dav/files/user/Photos/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
        <d:response><d:href>/nextcloud/remote.php/dav/files/user/Photos/Trips/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
        <d:response><d:href>/nextcloud/remote.php/dav/files/user/Photos/photo.jpg</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontenttype>image/jpeg</d:getcontenttype><d:getcontentlength>42</d:getcontentlength><d:getlastmodified>Fri, 04 Sep 2026 12:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response>
      </d:multistatus>
    """.trimIndent()

    val entries = RemoteInventoryXmlDecoder.decode(
      xml,
      "https://cloud.test/nextcloud/remote.php/dav/files/user/Photos/".toHttpUrl(),
      listOf("Photos"),
    )

    assertEquals(listOf("Trips", "photo.jpg"), entries.map(RemoteInventoryEntry::name))
    assertEquals(true, entries.first().collection)
    assertEquals("image/jpeg", entries.last().mimeType)
    assertEquals(42L, entries.last().byteCount)
  }

  private fun source() = SourceEntity(
    id = "source",
    accountId = "account",
    name = "Camera",
    kind = "media_store",
    localUri = "mediastore://camera",
    remotePathSegments = listOf("Photos"),
    enabled = true,
    createdAt = 0,
    lastScanAt = 1,
    blockerCode = null,
  )

  private fun local(
    name: String,
    state: String,
    completedAt: Long? = null,
    remoteName: String = name,
  ) = LocalInventoryView(
    sourceId = "source",
    sourceName = "Camera",
    sourceRemotePathSegments = listOf("Photos"),
    localUri = "content://$name",
    localRelativePath = name,
    mimeType = "image/jpeg",
    byteCount = 10,
    modifiedAt = 1,
    jobId = "job-$name",
    jobRemotePathSegments = listOf("Photos"),
    jobRemoteFileName = remoteName,
    jobState = state,
    jobCompletedAt = completedAt,
    jobRetryAt = null,
    jobLastErrorCode = null,
  )
}
