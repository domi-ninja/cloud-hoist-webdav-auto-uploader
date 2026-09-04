package ninja.domi.webdavautoupload.engine

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine

class WebDavUploadEngineModule : Module() {
  private lateinit var documentTreePicker:
    AppContextActivityResultLauncher<DocumentTreePickerInput, DocumentTreePickerResult>
  private val engine = FixtureUploadEngine { revision ->
    sendEvent("onSnapshotInvalidated", mapOf("revision" to revision))
  }
  private val accountRepository by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    AndroidAccountRepository(context, engineDatabase.engineDao())
  }
  private val engineDatabase by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    EngineRoomDatabase.open(context)
  }
  private val accountManager by lazy {
    AccountManager(
      repository = accountRepository,
      networkClient = NextcloudClient(),
      onAccountChanged = engine::accountChanged,
    )
  }
  private val remoteFolderManager by lazy {
    RemoteFolderManager(accountRepository, NextcloudDavClient())
  }
  private val documentTreeGateway by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    AndroidDocumentTreeGateway(context)
  }

  override fun definition() = ModuleDefinition {
    Name("WebDavUploadEngine")

    Events("onSnapshotInvalidated")

    RegisterActivityContracts {
      documentTreePicker = registerForActivityResult(DocumentTreePickerContract())
    }

    AsyncFunction("getSnapshotAsync") {
      engine.snapshot(accountManager.accountHealth())
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

    AsyncFunction("connectManualAsync") { input: ManualAccountInputRecord ->
      accountManager.connectManual(
        serverUrl = input.serverUrl,
        username = input.username,
        appPassword = input.appPassword,
      ).toMap()
    }

    AsyncFunction("startLoginFlowAsync") { serverUrl: String ->
      accountManager.startLoginFlow(serverUrl).toMap()
    }

    AsyncFunction("pollLoginFlowAsync") { attemptId: String ->
      accountManager.pollLoginFlow(attemptId).toMap()
    }

    AsyncFunction("cancelLoginFlowAsync") { attemptId: String ->
      accountManager.cancelLoginFlow(attemptId)
    }

    AsyncFunction("verifyStoredAccountAsync") {
      accountManager.verifyStoredAccount().toMap()
    }

    AsyncFunction("listRemoteFoldersAsync") { pathSegments: List<String> ->
      remoteFolderManager.list(pathSegments).map(RemoteFolder::toMap)
    }

    AsyncFunction("createRemoteFolderAsync") {
        parentPathSegments: List<String>, name: String ->
      remoteFolderManager.create(parentPathSegments, name).toMap()
    }

    AsyncFunction("pickDocumentTreeAsync") Coroutine { initialUri: String? ->
      when (val result = documentTreePicker.launch(DocumentTreePickerInput(initialUri))) {
        DocumentTreePickerResult.Cancelled -> null
        is DocumentTreePickerResult.Selected -> {
          documentTreeGateway.persistReadPermission(result.treeUri, result.resultFlags)
          mapOf("treeUri" to result.treeUri)
        }
      }
    }
  }
}
