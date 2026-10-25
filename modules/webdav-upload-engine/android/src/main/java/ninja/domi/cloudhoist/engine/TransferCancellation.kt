package ninja.domi.cloudhoist.engine

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/** Cancellation remains latched for an attempt even if the user immediately resumes. */
internal object TransferCancellation {
  private val global = AtomicLong()
  private val sources = ConcurrentHashMap<String, AtomicLong>()
  fun cancelAll() { global.incrementAndGet() }
  fun cancelSource(sourceId: String) { sources.computeIfAbsent(sourceId) { AtomicLong() }.incrementAndGet() }
  fun forAttempt(sourceId: String): () -> Boolean {
    val all = global.get()
    val source = sources.computeIfAbsent(sourceId) { AtomicLong() }
    val version = source.get()
    return { global.get() != all || source.get() != version }
  }
}
