package ninja.domi.cloudhoist.engine

import java.net.ServerSocket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.*
import org.junit.Test

class CancellableHttpTest {
  @Test fun cancellationInterruptsABlockedSocketWrite() {
    val cancelled = AtomicBoolean(false)
    val accepted = CountDownLatch(1)
    val release = CountDownLatch(1)
    val server = ServerSocket(0)
    val executor = Executors.newFixedThreadPool(2)
    try {
      executor.submit {
        server.accept().use { socket ->
          socket.receiveBufferSize = 1024
          accepted.countDown()
          release.await(5, TimeUnit.SECONDS)
        }
      }
      val body = object : okhttp3.RequestBody() {
        override fun contentType(): okhttp3.MediaType? = null
        override fun contentLength() = 1024L * 1024 * 256
        override fun writeTo(sink: okio.BufferedSink) {
          val bytes = ByteArray(65536)
          repeat(4096) { sink.write(bytes) }
        }
      }
      val result = executor.submit<Throwable?> {
        runCatching {
          executeCancellable(OkHttpClient(), Request.Builder().url("http://127.0.0.1:${server.localPort}/").put(body).build(), cancelled::get) { it.code }
        }.exceptionOrNull()
      }
      assertTrue(accepted.await(3, TimeUnit.SECONDS))
      Thread.sleep(200)
      cancelled.set(true)
      assertTrue(result.get(2, TimeUnit.SECONDS) is TransferCancelledException)
    } finally {
      release.countDown()
      server.close()
      executor.shutdownNow()
    }
  }

  @Test fun cancellationStaysLatchedAcrossImmediateResume() {
    val attempt = TransferCancellation.forAttempt("test-source")
    assertFalse(attempt())
    TransferCancellation.cancelSource("another-source")
    assertFalse(attempt())
    TransferCancellation.cancelSource("test-source")
    assertTrue(attempt())
    val resumed = TransferCancellation.forAttempt("test-source")
    assertFalse(resumed())
    TransferCancellation.cancelAll()
    assertTrue(resumed())
  }

  @Test fun cancellationClosesAConnectionWaitingForAResponse() {
    val cancelled = AtomicBoolean(false)
    val accepted = CountDownLatch(1)
    val closed = CountDownLatch(1)
    val server = ServerSocket(0)
    val executor = Executors.newFixedThreadPool(2)
    try {
      executor.submit {
        server.accept().use { socket ->
          accepted.countDown()
          while (socket.getInputStream().read() != -1) {}
          closed.countDown()
        }
      }
      val result = executor.submit<Throwable?> {
        runCatching {
          executeCancellable(OkHttpClient(), Request.Builder().url("http://127.0.0.1:${server.localPort}/").build(), cancelled::get) { it.code }
        }.exceptionOrNull()
      }
      assertTrue(accepted.await(3, TimeUnit.SECONDS))
      cancelled.set(true)
      assertTrue(result.get(2, TimeUnit.SECONDS) is TransferCancelledException)
      assertTrue(closed.await(2, TimeUnit.SECONDS))
    } finally {
      server.close()
      executor.shutdownNow()
    }
  }
}
