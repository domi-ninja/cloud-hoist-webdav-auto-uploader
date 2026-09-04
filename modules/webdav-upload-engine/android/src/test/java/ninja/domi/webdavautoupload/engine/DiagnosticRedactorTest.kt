package ninja.domi.webdavautoupload.engine

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DiagnosticRedactorTest {
  @Test
  fun removesCredentialsUrlsUrisAndAndroidPaths() {
    val sensitive = """
      Authorization: Basic abc123
      password=correct-horse
      https://domi:secret@cloud.example.test/path?token=opaque
      content://media/external/images/42
      /storage/emulated/0/DCIM/private.jpg
    """.trimIndent()

    val redacted = DiagnosticRedactor.redact(sensitive)

    listOf("abc123", "correct-horse", "domi", "secret", "opaque", "private.jpg")
      .forEach { value -> assertFalse("$value remained after redaction", redacted.contains(value)) }
    assertTrue(redacted.contains("[redacted]"))
    assertTrue(redacted.contains("[redacted-url]"))
    assertTrue(redacted.contains("[redacted-uri]"))
    assertTrue(redacted.contains("[redacted-path]"))
  }
}
