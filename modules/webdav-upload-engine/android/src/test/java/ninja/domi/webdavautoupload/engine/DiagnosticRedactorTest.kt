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

  @Test
  fun removesPrivateFieldsAndHeadersFromNestedErrorText() {
    val sensitive = """
      Upload failed: IOException(cause=GET https://cloud.example.test/private?token=query-secret)
        Authorization: Bearer header-secret
        Cookie: session=cookie-secret
        Set-Cookie: refresh=refresh-secret
        fileName=private-photo.jpg
        localPath=/data/user/0/app/private-photo.jpg
        remotePath="/Photos/private-photo.jpg"
        source=content://provider/private/tree
    """.trimIndent()

    val redacted = DiagnosticRedactor.redact(sensitive)

    listOf(
      "query-secret",
      "header-secret",
      "cookie-secret",
      "refresh-secret",
      "private-photo.jpg",
      "cloud.example.test",
      "content://provider",
    ).forEach { value ->
      assertFalse("$value remained after redaction", redacted.contains(value))
    }
    assertTrue(redacted.contains("Upload failed: IOException"))
  }
}
