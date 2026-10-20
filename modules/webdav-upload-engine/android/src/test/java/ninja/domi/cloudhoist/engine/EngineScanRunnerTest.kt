package ninja.domi.cloudhoist.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EngineScanRunnerTest {
  @Test
  fun mediaScanFiltersSourcesAndRequestsOneDrainForAddedJobs() {
    val requestedKinds = mutableListOf<String?>()
    val scanned = mutableListOf<String>()
    var drains = 0
    val runner = EngineScanRunner(
      sources = { kind ->
        requestedKinds += kind
        listOf(source("camera"), source("screenshots"))
      },
      scanSource = { id ->
        scanned += id
        result(id, jobsAdded = 1)
      },
      requestQueueDrain = { drains += 1 },
    )

    val result = runner.scanMedia()

    assertEquals(listOf("media_store"), requestedKinds)
    assertEquals(listOf("camera", "screenshots"), scanned)
    assertEquals(2, result.sourcesScanned)
    assertEquals(2, result.jobsAdded)
    assertEquals(1, drains)
    assertFalse(result.incomplete)
  }

  @Test
  fun reconciliationIncludesEveryEnabledSourceWithoutEmptyDrainWork() {
    var requestedKind: String? = "unset"
    var drains = 0
    val runner = EngineScanRunner(
      sources = { kind ->
        requestedKind = kind
        listOf(source("folder", kind = "saf"))
      },
      scanSource = { id -> result(id, jobsAdded = 0) },
      requestQueueDrain = { drains += 1 },
    )

    val result = runner.reconcile()

    assertEquals(null, requestedKind)
    assertEquals(1, result.sourcesScanned)
    assertEquals(0, drains)
  }

  @Test
  fun boundedRunPersistsItsDrainRequestBeforeYielding() {
    val clock = ArrayDeque(listOf(0L, 1L, 20L))
    var drains = 0
    val runner = EngineScanRunner(
      sources = { listOf(source("first"), source("later")) },
      scanSource = { id -> result(id, jobsAdded = 1) },
      requestQueueDrain = { drains += 1 },
      elapsedRealtimeNanos = clock::removeFirst,
      runBudgetNanos = 10,
    )

    val result = runner.reconcile()

    assertEquals(1, result.sourcesScanned)
    assertEquals(1, result.jobsAdded)
    assertTrue(result.incomplete)
    assertEquals(1, drains)
  }

  private fun result(sourceId: String, jobsAdded: Int) = SourceScanResult(
    sourceId = sourceId,
    preview = SourcePreview(0, 0, null),
    revisionsAdded = jobsAdded,
    jobsAdded = jobsAdded,
    blocker = null,
  )

  private fun source(id: String, kind: String = "media_store") = SourceEntity(
    id = id,
    accountId = "account",
    name = id,
    kind = kind,
    localUri = "mediastore://camera",
    remotePathSegments = emptyList(),
    enabled = true,
    createdAt = 0,
    lastScanAt = null,
    blockerCode = null,
  )
}
