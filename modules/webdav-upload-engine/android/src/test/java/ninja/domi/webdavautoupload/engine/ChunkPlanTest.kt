package ninja.domi.webdavautoupload.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChunkPlanTest {
  @Test
  fun smallAndUnsupportedUploadsStayOnTheDirectPath() {
    assertNull(chunkPlan(CHUNK_THRESHOLD_BYTES - 1, true, null))
    assertNull(chunkPlan(CHUNK_THRESHOLD_BYTES, false, null))
    assertNull(chunkPlan(CHUNK_THRESHOLD_BYTES, true, MIN_CHUNK_BYTES - 1))
  }

  @Test
  fun defaultPlanUsesOrderedFiveDigitNamesAndAShortLastChunk() {
    val plan = checkNotNull(
      chunkPlan(CHUNK_THRESHOLD_BYTES + 7, chunkingSupported = true, advertisedMaxChunkSize = null),
    )

    assertEquals(DEFAULT_CHUNK_BYTES, plan.chunkSize)
    assertEquals(listOf("00001", "00002", "00003"), plan.chunks.map { it.name })
    assertEquals(listOf(0L, DEFAULT_CHUNK_BYTES, DEFAULT_CHUNK_BYTES * 2), plan.chunks.map { it.offset })
    assertEquals(listOf(DEFAULT_CHUNK_BYTES, DEFAULT_CHUNK_BYTES, 7L), plan.chunks.map { it.byteCount })
  }

  @Test
  fun serverLimitCapsChunkSizeWithinNextcloudBounds() {
    val serverLimit = 6L * 1_024 * 1_024
    val plan = checkNotNull(chunkPlan(CHUNK_THRESHOLD_BYTES, true, serverLimit))

    assertEquals(serverLimit, plan.chunkSize)
    assertTrue(plan.chunks.dropLast(1).all { it.byteCount in MIN_CHUNK_BYTES..serverLimit })
  }

  @Test
  fun restoresTheExactSavedChunkSize() {
    val savedSize = 7L * 1_024 * 1_024

    val plan = checkNotNull(chunkPlan(CHUNK_THRESHOLD_BYTES, true, null, savedSize))

    assertEquals(savedSize, plan.chunkSize)
    assertEquals(
      listOf(savedSize, savedSize, CHUNK_THRESHOLD_BYTES - savedSize * 2),
      plan.chunks.map { it.byteCount },
    )
  }

  @Test
  fun hugeFilesIncreaseChunkSizeToStayWithinTenThousandChunks() {
    val bytes = DEFAULT_CHUNK_BYTES * MAX_CHUNK_COUNT + 1
    val plan = checkNotNull(chunkPlan(bytes, true, null))

    assertEquals(MAX_CHUNK_COUNT, plan.chunks.size)
    assertTrue(plan.chunkSize > DEFAULT_CHUNK_BYTES)
    assertEquals("10000", plan.chunks.last().name)
  }
}
