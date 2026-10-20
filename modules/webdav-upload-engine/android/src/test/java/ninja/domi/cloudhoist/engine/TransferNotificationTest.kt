package ninja.domi.cloudhoist.engine

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
  fun overallProgressUsesTheWholeQueueIncludingFailures() {
    assertEquals(OverallUploadProgress(10, 20), overallUploadProgress(QueueCounts(7, 1, 2, 10)))
    assertEquals(OverallUploadProgress(0, 0), overallUploadProgress(QueueCounts(0, 0, 0, 0)))
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
  fun failureDeepLinksIdentifyTheExactJob() {
    assertEquals("cloud-hoist:///upload-failure?jobId=job-123", blockerDeepLink("job-123"))
    assertEquals("cloud-hoist:///upload-failure?jobId=process%3Ajob", blockerDeepLink("process:job"))
  }

  @Test
  fun blockerMessagesNeverExposeRuntimeDetails() {
    assertEquals("Nextcloud storage is full.", blockerNotificationMessage("quota"))
    assertEquals(
      "Open this file to review why the upload failed.",
      blockerNotificationMessage("arbitrary-private-context"),
    )
  }
}
