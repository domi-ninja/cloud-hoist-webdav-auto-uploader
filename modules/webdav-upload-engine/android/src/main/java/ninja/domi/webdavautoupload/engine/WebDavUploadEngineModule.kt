package ninja.domi.webdavautoupload.engine

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WebDavUploadEngineModule : Module() {
  private val engine = FixtureUploadEngine { revision ->
    sendEvent("onSnapshotInvalidated", mapOf("revision" to revision))
  }

  override fun definition() = ModuleDefinition {
    Name("WebDavUploadEngine")

    Events("onSnapshotInvalidated")

    AsyncFunction("getSnapshotAsync") {
      engine.snapshot()
    }

    AsyncFunction("getSourcesAsync") {
      engine.sources()
    }

    AsyncFunction("getRecentActivityAsync") {
      engine.recentActivity()
    }

    AsyncFunction("getUnresolvedFailuresAsync") {
      engine.unresolvedFailures()
    }

    AsyncFunction("pauseAsync") {
      engine.pause()
    }

    AsyncFunction("resumeAsync") {
      engine.resume()
    }

    AsyncFunction("scanNowAsync") {
      engine.scanNow()
    }

    AsyncFunction("retryFailedAsync") {
      engine.retryFailed()
    }

    AsyncFunction("addOrUpdateSourceAsync") { source: SourceInputRecord ->
      engine.addOrUpdateSource(source)
    }

    AsyncFunction("removeSourceAsync") { sourceId: String ->
      engine.removeSource(sourceId)
    }

    AsyncFunction("resetSourceHistoryAsync") { sourceId: String ->
      engine.resetSourceHistory(sourceId)
    }
  }
}
