package ninja.domi.cloudhoist.engine

import org.junit.Assert.assertEquals
import org.junit.Test

class DestinationPathTest {
  @Test fun preservesCustomizedSuffixAndUnicode() {
    assertEquals(listOf("New", "Private", "Ferien ü", "2024"),
      destinationUnderNewRoot(listOf("Old", "Private", "Ferien ü", "2024"), listOf("Old"), listOf("New")))
  }
  @Test fun exactRootDestinationHasNoInventedLocalSuffix() {
    assertEquals(listOf("New"), destinationUnderNewRoot(listOf("Old"), listOf("Old"), listOf("New")))
  }
  @Test fun repairsLegacyCloudHoistPreferenceMismatchWithoutInferringLocalNames() {
    assertEquals(listOf("New", "Custom"), destinationUnderNewRoot(listOf("Cloud Hoist", "Custom"), listOf("Phone Uploads"), listOf("New")))
  }
  @Test fun preservesEntireOutsideRootCustomPathAndRespectsSegmentBoundaries() {
    assertEquals(listOf("New", "Old photos", "Custom"), destinationUnderNewRoot(listOf("Old photos", "Custom"), listOf("Old"), listOf("New")))
  }
  @Test fun supportsAccountRootAndNestedRootChanges() {
    assertEquals(listOf("New", "Custom"), destinationUnderNewRoot(listOf("Custom"), emptyList(), listOf("New")))
    assertEquals(listOf("Custom"), destinationUnderNewRoot(listOf("Old", "Root", "Custom"), listOf("Old", "Root"), emptyList()))
  }
  @Test fun numberedNamesPreserveExtensionAndHandleDotfilesAndUnicode() {
    for ((name, expected) in listOf("a.jpg" to "a_2.jpg", ".hidden" to ".hidden_2", "README" to "README_2", "Grüezi #.tar.gz" to "Grüezi #.tar_2.gz")) {
      assertEquals(listOf("Folder", expected), numberedDestination(listOf("Folder", name), 2))
    }
  }
  @Test fun readsPendingJournalFromPreviousRelease() {
    val file = DestinationFile("s", "r", "j", listOf("A", "x"), listOf("B", "x"), "old", true)
    val operation = DestinationOperation("op", emptyList(), listOf(file), null, "move", "failed")
    val json = operation.json()
    json.getJSONArray("files").getJSONObject(0).apply { remove("originalTo"); remove("duplicateEtag") }
    assertEquals(operation, DestinationOperation.read(json.toString()))
  }
  @Test fun journalRoundTripRetainsConditionalMoveReceipt() {
    val file = DestinationFile("s", "r", "j", listOf("A", "photo.jpg"), listOf("B", "photo.jpg"), "etag", true, true, true)
    val operation = DestinationOperation("op", listOf(DestinationRoute("s", "Camera", listOf("A"), listOf("B"))), listOf(file), listOf("B"), "move")
    assertEquals(operation, DestinationOperation.read(operation.json().toString()))
  }
}
