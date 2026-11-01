package ninja.domi.cloudhoist.engine

import io.sentry.SentryEvent
import io.sentry.protocol.Message
import io.sentry.protocol.Request
import io.sentry.protocol.SentryException
import io.sentry.protocol.SentryStackFrame
import io.sentry.protocol.SentryStackTrace
import io.sentry.protocol.User
import org.junit.Assert.*
import org.junit.Test

class BackgroundDiagnosticsTest {
  @Test fun stripsPrivateDataButKeepsFailureLocation() {
    val event = SentryEvent().apply {
      user = User().apply { email = "private@example.com" }
      request = Request().apply { url = "https://private.example.com/files" }
      message = Message().apply { formatted = "private file name" }
      setExtra("password", "secret")
      exceptions = listOf(SentryException().apply {
        type = "IllegalStateException"
        value = "/storage/emulated/0/private.jpg"
        stacktrace = SentryStackTrace(listOf(SentryStackFrame().apply {
          module = "ninja.domi.cloudhoist.engine.EngineScanRunner"
          function = "scan"
          lineno = 42
          absPath = "/data/private/file"
          vars = mapOf("password" to "secret")
        }))
      })
    }
    val safe = BackgroundDiagnostics.sanitize(event)
    assertNull(safe.user)
    assertNull(safe.request)
    assertNull(safe.getExtra("password"))
    assertEquals("Unhandled native error", safe.message?.formatted)
    val error = safe.exceptions!!.single()
    assertNull(error.value)
    assertEquals("IllegalStateException", error.type)
    assertEquals(42, error.stacktrace!!.frames!!.single().lineno)
    assertNull(error.stacktrace!!.frames!!.single().absPath)
    assertNull(error.stacktrace!!.frames!!.single().vars)
  }

  @Test fun retainsOnlyOurSchedulerFields() {
    val event = SentryEvent().apply {
      logger = "cloud-hoist.background"
      setTag("reason", "APP_OPENED")
      setTag("username", "private")
      setExtra("pendingJobs", 4)
      setExtra("password", "secret")
    }
    val safe = BackgroundDiagnostics.sanitize(event)
    assertEquals("APP_OPENED", safe.message?.formatted)
    assertEquals(4, safe.getExtra("pendingJobs"))
    assertNull(safe.getExtra("password"))
    assertNull(safe.getTag("username"))
  }
}
