package ninja.domi.webdavautoupload.engine

import java.nio.file.Files
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DiagnosticEventLogTest {
  @Test
  fun retainsSevenDaysAndDropsOlderEvents() {
    val directory = Files.createTempDirectory("diagnostic-log").toFile()
    var clock = 0L
    val log = DiagnosticEventLog(directory.resolve("events.jsonl"), now = { clock })
    log.record(DiagnosticEventCode.ENGINE_PAUSED)
    clock = TimeUnit.DAYS.toMillis(8)
    log.record(DiagnosticEventCode.ENGINE_RESUMED)

    assertEquals(listOf("engine_resumed"), log.events().map { it["code"] })
    directory.deleteRecursively()
  }

  @Test
  fun staysUnderItsByteCapAndKeepsTheNewestEvents() {
    val directory = Files.createTempDirectory("diagnostic-log").toFile()
    val file = directory.resolve("events.jsonl")
    val log = DiagnosticEventLog(file, maxBytes = 256)

    repeat(20) { log.recordUploadResult("error_$it") }

    assertTrue(file.length() <= 256)
    assertEquals("error_19", log.events().last()["resultCode"])
    assertFalse(log.events().any { it["resultCode"] == "error_0" })
    directory.deleteRecursively()
  }

  @Test
  fun storesOnlyAllowlistedFailureContextAndCanBeCleared() {
    val directory = Files.createTempDirectory("diagnostic-log").toFile()
    val file = directory.resolve("events.jsonl")
    val log = DiagnosticEventLog(file)

    log.recordUploadResult("https://user:secret@example.test/path?token=private")

    assertEquals("unexpected", log.events().single()["resultCode"])
    assertFalse(file.readText().contains("secret"))
    log.clear()
    assertTrue(log.events().isEmpty())
    directory.deleteRecursively()
  }
}
