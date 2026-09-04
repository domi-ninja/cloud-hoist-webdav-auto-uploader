package ninja.domi.webdavautoupload.engine

import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions

class WebDavUploadEngineModule : Module() {
  private lateinit var documentTreePicker:
    AppContextActivityResultLauncher<DocumentTreePickerInput, DocumentTreePickerResult>
  private val accountRepository by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    AndroidAccountRepository(context, engineDatabase.engineDao())
  }
  private val engineDatabase by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    EngineRoomDatabase.open(context)
  }
  private val engine by lazy {
    RoomEngineView(
      dao = engineDatabase.engineDao(),
      onInvalidated = { revision ->
        sendEvent("onSnapshotInvalidated", mapOf("revision" to revision))
      },
    )
  }
  private val accountManager by lazy {
    AccountManager(
      repository = accountRepository,
      networkClient = NextcloudClient(),
      onAccountChanged = engine::invalidate,
    )
  }
  private val remoteFolderManager by lazy {
    RemoteFolderManager(accountRepository, NextcloudDavClient())
  }
  private val documentTreeGateway by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    AndroidDocumentTreeGateway(context)
  }
  private val sourceDiscoveryManager by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    SourceDiscoveryManager(
      accountRepository = accountRepository,
      recorder = SourceRevisionRecorder(engineDatabase.engineDao()),
      mediaDiscovery = AndroidMediaStoreDiscovery(context),
      documentTreeDiscovery = DocumentTreeDiscovery(documentTreeGateway),
    )
  }
  private val mediaPermissionController by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    MediaPermissionController(
      context,
      appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound(),
    )
  }
  private val notificationPermissionController by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    NotificationPermissionController(
      context,
      appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound(),
    )
  }
  private val workScheduler by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    EngineWorkScheduler(context)
  }
  private val enginePreferences by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    EnginePreferences(context)
  }
  private val signOutCleanup by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    SignOutCleanup(
      context = context,
      dao = engineDatabase.engineDao(),
      accountRepository = accountRepository,
      enginePreferences = enginePreferences,
      cancelWork = workScheduler::cancelAll,
      releaseReadPermission = { sourceUri ->
        context.contentResolver.releasePersistableUriPermission(
          Uri.parse(sourceUri),
          Intent.FLAG_GRANT_READ_URI_PERMISSION,
        )
      },
    )
  }

  override fun definition() = ModuleDefinition {
    Name("WebDavUploadEngine")

    Events("onSnapshotInvalidated")

    OnCreate {
      signOutCleanup.finishInterruptedSignOut()
      if (accountRepository.currentAccount() != null) workScheduler.ensureScheduled()
    }

    RegisterActivityContracts {
      documentTreePicker = registerForActivityResult(DocumentTreePickerContract())
    }

    AsyncFunction("getSnapshotAsync") {
      engine.snapshot(accountManager.accountHealth(), enginePreferences.status())
    }

    AsyncFunction("getSourcesAsync") {
      engine.sources()
    }

    AsyncFunction("getActivityPageAsync") { offset: Int ->
      engine.activityPage(offset)
    }

    AsyncFunction("getUnresolvedFailuresAsync") {
      engine.unresolvedFailures()
    }

    AsyncFunction("getDiagnosticReportAsync") {
      DiagnosticReportBuilder(engineDatabase.engineDao()).build(
        accountRepository.currentAccount(),
        enginePreferences.status(),
      )
    }

    AsyncFunction("pauseAsync") {
      workScheduler.pause()
      engine.invalidate()
    }

    AsyncFunction("resumeAsync") {
      workScheduler.resume()
      engine.invalidate()
    }

    AsyncFunction("scanNowAsync") {
      workScheduler.requestFullScan()
      engine.invalidate()
    }

    AsyncFunction("retryFailedAsync") {
      engine.retryFailed()
      workScheduler.requestQueueDrain()
    }

    AsyncFunction("clearCompletedHistoryAsync") {
      engine.clearCompletedHistory()
    }

    AsyncFunction("setTransferConstraintsAsync") { input: TransferConstraintsRecord ->
      workScheduler.updateDrainConstraints(input.toConstraints())
      engine.invalidate()
    }

    AsyncFunction("addOrUpdateSourceAsync") { source: SourceInputRecord ->
      val account = accountRepository.currentAccount() ?: throw AccountNotConfiguredException()
      engine.addOrUpdateSource(source, account.id)
      workScheduler.ensureScheduled()
      workScheduler.requestQueueDrain()
    }

    AsyncFunction("removeSourceAsync") { sourceId: String ->
      val dao = engineDatabase.engineDao()
      val source = dao.source(sourceId) ?: throw EngineSourceNotFoundException(sourceId)
      engine.removeSource(sourceId)
      if (source.kind == "saf" && dao.allSources().none { it.localUri == source.localUri }) {
        val context = appContext.reactContext ?: throw AccountStorageException()
        runCatching {
          context.contentResolver.releasePersistableUriPermission(
            Uri.parse(source.localUri),
            Intent.FLAG_GRANT_READ_URI_PERMISSION,
          )
        }
      }
    }

    AsyncFunction("resetSourceHistoryAsync") { sourceId: String ->
      engine.resetSourceHistory(sourceId)
      workScheduler.requestFullScan()
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

    AsyncFunction("signOutAsync") {
      workScheduler.pause()
      signOutCleanup.signOut()
      engine.invalidate()
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

    AsyncFunction("previewSourceAsync") { selection: SourceSelectionRecord ->
      sourceDiscoveryManager.preview(selection.toSelection()).toMap()
    }

    AsyncFunction("commitSourceAsync") { source: SourceCommitRecord ->
      sourceDiscoveryManager.commit(source.toCommit()).also { result ->
        engine.invalidate()
        workScheduler.ensureScheduled()
        if (result.jobsAdded > 0) workScheduler.requestQueueDrain()
      }.toMap()
    }

    AsyncFunction("getMediaPermissionAsync") { promise: Promise ->
      mediaPermissionController.get { state -> promise.resolve(state.toMap()) }
    }

    AsyncFunction("requestMediaPermissionAsync") { promise: Promise ->
      mediaPermissionController.request { state -> promise.resolve(state.toMap()) }
    }

    AsyncFunction("getNotificationPermissionAsync") { promise: Promise ->
      notificationPermissionController.get { state -> promise.resolve(state.toMap()) }
    }

    AsyncFunction("requestNotificationPermissionAsync") { promise: Promise ->
      notificationPermissionController.request { state -> promise.resolve(state.toMap()) }
    }

    AsyncFunction("scanSourceAsync") { sourceId: String ->
      sourceDiscoveryManager.scan(sourceId).also { result ->
        engine.invalidate()
        if (result.jobsAdded > 0) workScheduler.requestQueueDrain()
      }.toMap()
    }
  }
}
