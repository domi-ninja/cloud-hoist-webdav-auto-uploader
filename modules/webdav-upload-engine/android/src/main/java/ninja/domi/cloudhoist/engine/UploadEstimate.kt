package ninja.domi.cloudhoist.engine

import kotlin.math.ceil

data class UploadTiming(val bytes: Long, val durationMillis: Long)

/** Uses recent transfer time, excluding the time jobs spent waiting in the queue. */
fun estimateRemainingSeconds(remainingBytes: Long, timings: List<UploadTiming>): Long? {
  val usable = timings.filter { it.bytes > 0 && it.durationMillis > 0 }
  val bytes = usable.sumOf { it.bytes.toDouble() }
  val millis = usable.sumOf { it.durationMillis.toDouble() }
  if (bytes == 0.0 || millis < 1_000) return null
  return ceil(remainingBytes.coerceAtLeast(0) * millis / bytes / 1_000).toLong()
}
