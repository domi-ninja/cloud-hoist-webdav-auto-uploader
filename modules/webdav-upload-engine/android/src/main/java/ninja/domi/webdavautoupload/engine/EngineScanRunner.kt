package ninja.domi.webdavautoupload.engine

import android.content.Context
import java.util.concurrent.TimeUnit

data class ScanBatchResult(
  val sourcesScanned: Int,
  val jobsAdded: Int,
  val incomplete: Boolean,
)

/** Runs sources sequentially and stops before WorkManager's execution budget is exhausted. */
class EngineScanRunner(
  private val sources: (String?) -> List<SourceEntity>,
  private val scanSource: (String) -> SourceScanResult,
  private val requestQueueDrain: () -> Unit,
  private val elapsedRealtimeNanos: () -> Long = System::nanoTime,
  private val runBudgetNanos: Long = TimeUnit.MINUTES.toNanos(8),
) {
  fun scanMedia(): ScanBatchResult = scan("media_store")

  fun reconcile(): ScanBatchResult = scan(null)

  private fun scan(kind: String?): ScanBatchResult {
    val startedAt = elapsedRealtimeNanos()
    var sourcesScanned = 0
    var jobsAdded = 0
    val pending = sources(kind)
    for (source in pending) {
      if (elapsedRealtimeNanos() - startedAt >= runBudgetNanos) {
        if (jobsAdded > 0) requestQueueDrain()
        return ScanBatchResult(sourcesScanned, jobsAdded, incomplete = true)
      }
      val result = try {
        scanSource(source.id)
      } catch (_: EngineSourceNotFoundException) {
        continue
      }
      sourcesScanned += 1
      jobsAdded += result.jobsAdded
    }
    if (jobsAdded > 0) requestQueueDrain()
    return ScanBatchResult(sourcesScanned, jobsAdded, incomplete = false)
  }

  companion object {
    fun create(context: Context): EngineScanRunner {
      val database = EngineRoomDatabase.open(context)
      val dao = database.engineDao()
      val accountRepository = AndroidAccountRepository(context, dao)
      val documentGateway = AndroidDocumentTreeGateway(context)
      val manager = SourceDiscoveryManager(
        accountRepository = accountRepository,
        recorder = SourceRevisionRecorder(dao),
        mediaDiscovery = AndroidMediaStoreDiscovery(context),
        documentTreeDiscovery = DocumentTreeDiscovery(documentGateway),
      )
      val scheduler = EngineWorkScheduler(context)
      return EngineScanRunner(
        sources = dao::enabledSources,
        scanSource = manager::scan,
        requestQueueDrain = scheduler::requestQueueDrain,
      )
    }
  }
}
