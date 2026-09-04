package ninja.domi.webdavautoupload.engine

import org.junit.Assert.assertEquals
import org.junit.Test

class TransferNotificationTest {
  @Test
  fun clampsProgressToAValidPercentage() {
    assertEquals(0, transferPercent(-1, 100))
    assertEquals(52, transferPercent(52, 100))
    assertEquals(100, transferPercent(101, 100))
    assertEquals(0, transferPercent(1, 0))
  }

  @Test
  fun removesControlCharactersAndBoundsTheDisplayedFileName() {
    val unsafe = "  photo\n\u0000" + "x".repeat(100) + ".jpg  "

    val safe = safeTransferFileName(unsafe)

    assertEquals(80, safe.length)
    assertEquals(false, safe.any(Char::isISOControl))
    assertEquals("File", safeTransferFileName("\n\u0000"))
  }

  @Test
  fun blockerScopesDeepLinkToTheirRepairScreen() {
    assertEquals("webdav-auto-upload:///", blockerDeepLink(BlockerScope.ACCOUNT))
    assertEquals("webdav-auto-upload:///", blockerDeepLink(BlockerScope.SOURCE))
    assertEquals("webdav-auto-upload:///activity", blockerDeepLink(BlockerScope.JOB))
  }

  @Test
  fun blockerMessagesNeverExposeRuntimeDetails() {
    assertEquals("Nextcloud storage is full.", blockerNotificationMessage("quota"))
    assertEquals(
      "Open Activity to review the upload problem.",
      blockerNotificationMessage("arbitrary-private-context"),
    )
  }
}
