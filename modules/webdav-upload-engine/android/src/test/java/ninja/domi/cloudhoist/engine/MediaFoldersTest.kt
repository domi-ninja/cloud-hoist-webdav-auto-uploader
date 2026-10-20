package ninja.domi.cloudhoist.engine

import org.junit.Assert.*
import org.junit.Test

class MediaFoldersTest {
  @Test fun groupsEveryMediaDirectoryByItsFullPathAndVolume() {
    fun item(path: String, bytes: Long, volume: String = "external_primary") = MediaStoreItem(
      "id", "content://media/id", "file.jpg", bytes, 10, "image/jpeg", path, "Media", volumeName = volume,
    )
    val folders = groupMediaFolders(listOf(
      item("Android/media/chat.app/Media/", 20), item("Android/media/chat.app/Media/", 30),
      item("Pictures/Random/", 40), item("Pictures/Random/", 10, "1234-5678"),
    ))
    assertEquals(3, folders.size)
    assertEquals(MediaFolder("external_primary", "Android/media/chat.app/Media/", 2, 50), folders.first())
    assertEquals(100L, folders.sumOf { it.totalBytes })
  }
  @Test fun rejectsTraversalAndEmptyPaths() {
    for (path in listOf("", "/Pictures/", "Pictures/../", "Pictures/".removeSuffix("/"))) {
      try { validateMediaFolder("external_primary", path); fail("Accepted $path") }
      catch (_: EngineInvalidInputException) { }
    }
  }
}
