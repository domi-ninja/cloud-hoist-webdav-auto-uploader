package ninja.domi.cloudhoist.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class DocumentTreeDiscoveryTest {
  @Test
  fun keepsDeepRelativePathsAndDuplicateFileNames() {
    val gateway = FakeDocumentTreeGateway(
      "root" to listOf(directory("a"), directory("b")),
      "a" to listOf(directory("deep")),
      "deep" to listOf(file("first", "same.jpg", size = 10, modified = 2_000)),
      "b" to listOf(file("second", "same.jpg", size = 20, modified = 1_000)),
    )

    val files = DocumentTreeDiscovery(gateway).discover(TREE_URI)

    assertEquals(listOf("second", "first"), files.map(DiscoveredFile::providerId))
    assertEquals(listOf("b"), files[0].relativePathSegments)
    assertEquals(listOf("a", "deep"), files[1].relativePathSegments)
    assertEquals(30L, files.toSourcePreview().totalBytes)
  }

  @Test
  fun includesDotfilesButSkipsNomedia() {
    val gateway = FakeDocumentTreeGateway(
      "root" to listOf(
        file("hidden", ".kept", size = 1),
        file("metadata", ".nomedia", size = 2),
      ),
    )

    assertEquals(
      listOf(".kept"),
      DocumentTreeDiscovery(gateway).discover(TREE_URI).map(DiscoveredFile::fileName),
    )
  }

  @Test
  fun handlesEmptyTreesMissingMetadataAndProviderCycles() {
    assertEquals(
      emptyList<DiscoveredFile>(),
      DocumentTreeDiscovery(FakeDocumentTreeGateway("root" to emptyList())).discover(TREE_URI),
    )
    val cyclic = FakeDocumentTreeGateway(
      "root" to listOf(directory("nested")),
      "nested" to listOf(directory("root"), file("unknown", "unknown.bin")),
    )

    val file = DocumentTreeDiscovery(cyclic).discover(TREE_URI).single()

    assertEquals(0L, file.byteCount)
    assertEquals(0L, file.modifiedAtEpochSeconds)
    assertEquals(listOf("nested"), file.relativePathSegments)
  }

  @Test
  fun failsTheScanWhenAnyDocumentIsUnreadable() {
    val error = assertThrows(SourceAccessException::class.java) {
      DocumentTreeDiscovery(
        FakeDocumentTreeGateway(
          "root" to listOf(file("secret", "secret.txt", readable = false)),
        ),
      ).discover(TREE_URI)
    }

    assertEquals(SourceAccessBlocker.UNREADABLE_DOCUMENT, error.blocker)
  }

  @Test
  fun rejectsASelectedUriThatNoLongerResolvesToADirectory() {
    val gateway = FakeDocumentTreeGateway(
      children = emptyMap(),
      root = file("gone", "gone"),
    )

    val error = assertThrows(SourceAccessException::class.java) {
      DocumentTreeDiscovery(gateway).discover(TREE_URI)
    }

    assertEquals(SourceAccessBlocker.FOLDER_UNAVAILABLE, error.blocker)
  }

  private class FakeDocumentTreeGateway(
    private val children: Map<String, List<DocumentTreeNode>>,
    private val root: DocumentTreeNode = directory("root"),
  ) : DocumentTreeGateway {
    constructor(
      vararg children: Pair<String, List<DocumentTreeNode>>,
    ) : this(mapOf(*children))

    override fun root(treeUri: String) = root

    override fun children(
      treeUri: String,
      directoryProviderId: String,
    ) = children[directoryProviderId].orEmpty()
  }

  private companion object {
    const val TREE_URI = "content://fixture/tree/root"

    fun directory(id: String) = DocumentTreeNode(
      providerId = id,
      displayName = id,
      localUri = "$TREE_URI/document/$id",
      isDirectory = true,
      isReadable = true,
      byteCount = null,
      modifiedAtEpochMillis = null,
      mimeType = null,
    )

    fun file(
      id: String,
      name: String,
      size: Long? = null,
      modified: Long? = null,
      readable: Boolean = true,
    ) = DocumentTreeNode(
      providerId = id,
      displayName = name,
      localUri = "$TREE_URI/document/$id",
      isDirectory = false,
      isReadable = readable,
      byteCount = size,
      modifiedAtEpochMillis = modified,
      mimeType = "application/octet-stream",
    )
  }
}
