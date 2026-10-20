package ninja.domi.cloudhoist.engine

import org.junit.Assert.*
import org.junit.Test

class UploadEstimateTest {
  @Test fun requiresAUsefulSample() {
    assertNull(estimateRemainingSeconds(1000, emptyList()))
    assertNull(estimateRemainingSeconds(1000, listOf(UploadTiming(500, 100))))
    assertNull(estimateRemainingSeconds(1000, listOf(UploadTiming(0, 2000))))
  }
  @Test fun weightsByBytesAndTransferTime() {
    assertEquals(6L, estimateRemainingSeconds(2000, listOf(UploadTiming(500, 1000), UploadTiming(1000, 3000))))
    assertEquals(0L, estimateRemainingSeconds(-1, listOf(UploadTiming(500, 1000))))
  }
}
