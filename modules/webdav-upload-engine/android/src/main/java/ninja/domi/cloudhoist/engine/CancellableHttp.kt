package ninja.domi.cloudhoist.engine

import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

private val cancellationWatch = Executors.newSingleThreadScheduledExecutor { task ->
  Thread(task, "upload-cancellation").apply { isDaemon = true }
}

/** Cancels even when a socket write or response read is blocked. Cleanup calls use a separate request. */
internal fun <T> executeCancellable(
  client: OkHttpClient,
  request: Request,
  isCancelled: () -> Boolean,
  read: (Response) -> T,
): T {
  if (isCancelled()) throw TransferCancelledException()
  val call = client.newCall(request)
  val cancelled = AtomicBoolean(false)
  val watch = cancellationWatch.scheduleWithFixedDelay({
    if (isCancelled()) {
      cancelled.set(true)
      call.cancel()
    }
  }, 0, 100, TimeUnit.MILLISECONDS)
  try {
    return call.execute().use(read)
  } catch (error: Exception) {
    if (cancelled.get() || isCancelled()) throw TransferCancelledException()
    throw error
  } finally {
    watch.cancel(false)
  }
}
