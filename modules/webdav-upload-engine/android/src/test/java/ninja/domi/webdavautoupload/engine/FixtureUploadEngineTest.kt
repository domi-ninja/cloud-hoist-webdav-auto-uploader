package ninja.domi.webdavautoupload.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class FixtureUploadEngineTest {
  @Test
  fun snapshotHasTheCompleteBridgeContract() {
    val engine = FixtureUploadEngine {}

    assertEquals(
      setOf(
        "revision",
        "account",
        "engine",
        "sources",
        "queue",
        "recentJobs",
        "blockers",
        "worker",
        "scheduler",
      ),
      engine.snapshot().keys,
    )
  }

  @Test
  fun commandsIncrementRevisionAndInvalidate() {
    val invalidations = mutableListOf<Int>()
    val engine = FixtureUploadEngine(invalidations::add)

    engine.pause()
    engine.resume()
    engine.scanNow()

    assertEquals(listOf(2, 3, 4), invalidations)
    assertEquals(4, engine.snapshot()["revision"])
  }

  @Test
  fun unknownSourceUsesStableCodedException() {
    val engine = FixtureUploadEngine {}

    val error = assertThrows(EngineSourceNotFoundException::class.java) {
      engine.removeSource("missing")
    }

    assertEquals("ERR_ENGINE_SOURCE_NOT_FOUND", error.code)
  }
}
