package ninja.domi.webdavautoupload.engine

data class UploadChunk(
  val number: Int,
  val name: String,
  val offset: Long,
  val byteCount: Long,
)

data class ChunkPlan(
  val chunkSize: Long,
  val chunks: List<UploadChunk>,
)

/** Builds Nextcloud v2 chunks. The last chunk alone may be smaller than 5 MiB. */
fun chunkPlan(
  totalBytes: Long,
  chunkingSupported: Boolean,
  advertisedMaxChunkSize: Long?,
): ChunkPlan? {
  if (!chunkingSupported || totalBytes < CHUNK_THRESHOLD_BYTES) return null
  val maximum = minOf(advertisedMaxChunkSize ?: MAX_CHUNK_BYTES, MAX_CHUNK_BYTES)
  if (maximum < MIN_CHUNK_BYTES) return null

  val requiredForChunkLimit = ceilDivision(totalBytes, MAX_CHUNK_COUNT.toLong())
  val chunkSize = maxOf(MIN_CHUNK_BYTES, DEFAULT_CHUNK_BYTES, requiredForChunkLimit)
    .coerceAtMost(maximum)
  val count = ceilDivision(totalBytes, chunkSize)
  if (count !in 1..MAX_CHUNK_COUNT.toLong()) return null

  return ChunkPlan(
    chunkSize = chunkSize,
    chunks = List(count.toInt()) { index ->
      val number = index + 1
      val offset = index * chunkSize
      UploadChunk(
        number = number,
        name = number.toString().padStart(CHUNK_NAME_WIDTH, '0'),
        offset = offset,
        byteCount = minOf(chunkSize, totalBytes - offset),
      )
    },
  )
}

private fun ceilDivision(value: Long, divisor: Long) =
  value / divisor + if (value % divisor == 0L) 0L else 1L

const val CHUNK_THRESHOLD_BYTES = 20L * 1_024 * 1_024
const val DEFAULT_CHUNK_BYTES = 10L * 1_024 * 1_024
const val MIN_CHUNK_BYTES = 5L * 1_024 * 1_024
const val MAX_CHUNK_BYTES = 5L * 1_024 * 1_024 * 1_024
const val MAX_CHUNK_COUNT = 10_000
const val CHUNK_NAME_WIDTH = 5
