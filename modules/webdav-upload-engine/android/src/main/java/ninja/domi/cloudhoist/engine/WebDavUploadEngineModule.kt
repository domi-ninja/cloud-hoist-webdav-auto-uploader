package ninja.domi.cloudhoist.engine

import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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
  private val destinationChanges by lazy {
    DestinationChangeManager(engineDatabase, accountRepository)
  }
  private val fileInventoryManager by lazy {
    FileInventoryManager(
      engineDatabase.engineDao(),
      accountRepository,
      NextcloudInventoryClient(),
    )
  }
  private val remoteThumbnailManager by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    RemoteThumbnailManager(context, engineDatabase.engineDao(), accountRepository)
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
  private val constraintChecker by lazy {
    TransferConstraintChecker(appContext.reactContext ?: throw AccountStorageException())
  }
  private val diagnosticLog by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    DiagnosticEventLog(context)
  }
  private val chunkSessionCleanup by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    ChunkSessionCleanup(
      engineDatabase.engineDao(),
      accountRepository,
      NextcloudChunkTransport(AndroidLocalContentSource(context.contentResolver)),
    )
  }
  private val sourceRemovalCleanup by lazy {
    val context = appContext.reactContext ?: throw AccountStorageException()
    SourceRemovalCleanup(
      context,
      engineDatabase.engineDao(),
      releaseReadPermission = { sourceUri ->
        context.contentResolver.releasePersistableUriPermission(
          Uri.parse(sourceUri),
          Intent.FLAG_GRANT_READ_URI_PERMISSION,
        )
      },
    )
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
      cleanupRemoteSessions = chunkSessionCleanup::run,
      clearDiagnostics = diagnosticLog::clear,
    )
  }

  override fun definition() = ModuleDefinition {
    Name("WebDavUploadEngine")

    Events("onSnapshotInvalidated")

    OnCreate {
      signOutCleanup.finishInterruptedSignOut()
      sourceRemovalCleanup.finishInterruptedRemoval()
      if (accountRepository.currentAccount() != null) workScheduler.ensureScheduled()
    }

    RegisterActivityContracts {
      documentTreePicker = registerForActivityResult(DocumentTreePickerContract())
    }

    AsyncFunction("getSnapshotAsync") {
      engine.snapshot(
        accountManager.accountHealth(),
        enginePreferences.status(),
        constraintChecker.waitingReason(),
        workScheduler.queueDrainStatus(),
      )
    }

    AsyncFunction("getBackupRootAsync") Coroutine { fallback: List<String> ->
      withContext(Dispatchers.IO) { destinationChanges.root(fallback) }
    }

    AsyncFunction("previewDestinationChangeAsync") Coroutine { request: DestinationChangeRequest ->
      withContext(Dispatchers.IO) { destinationChanges.preview(request) }
    }

    AsyncFunction("beginDestinationChangeAsync") Coroutine { request: DestinationChangeRequest, mode: String ->
      withContext(Dispatchers.IO) { destinationChanges.begin(request, mode).also { engine.invalidate() } }
    }

    AsyncFunction("getDestinationChangeAsync") Coroutine { ->
      withContext(Dispatchers.IO) { destinationChanges.pending()?.summary() }
    }

    AsyncFunction("runDestinationChangeAsync") Coroutine { id: String, uploadCopies: Boolean ->
      withContext(Dispatchers.IO) { destinationChanges.run(id, uploadCopies).also { engine.invalidate() } }
    }

    AsyncFunction("acknowledgeDestinationChangeAsync") Coroutine { id: String ->
      withContext(Dispatchers.IO) {
        destinationChanges.acknowledge(id)
        val root = destinationChanges.root()
        val rootJson = org.json.JSONArray(root).toString()
        val lastUpload = engineDatabase.engineDao().latestCompletedUploadInRoot(rootJson, rootJson.dropLast(1) + ",%")
        accountRepository.credential()?.let { credential ->
          runCatching { PhoneUploadReadme().write(credential, lastUpload?.let(java.time.Instant::ofEpochMilli), onlyIfMissing = true, root = root) }
        }
        engine.invalidate()
        workScheduler.requestFullScan()
        workScheduler.requestQueueDrain()
      }
    }

    AsyncFunction("getSourcesAsync") {
      engine.sources()
    }

    AsyncFunction("getActivityPageAsync") { offset: Int ->
      engine.activityPage(offset)
    }

    AsyncFunction("getFileInventoryPageAsync") Coroutine { offset: Int, filter: InventoryFilterRecord ->
      withContext(Dispatchers.IO) {
        fileInventoryManager.page(offset, filter = filter.toFilter()).toMap()
      }
    }

    AsyncFunction("getRemoteThumbnailAsync") Coroutine {
        sourceId: String, relativePath: String, version: String? ->
      withContext(Dispatchers.IO) {
        remoteThumbnailManager.thumbnail(sourceId, relativePath, version)
      }
    }

    AsyncFunction("getUnresolvedFailuresAsync") {
      engine.unresolvedFailures()
    }

    AsyncFunction("getDiagnosticReportAsync") {
      DiagnosticReportBuilder(engineDatabase.engineDao(), diagnosticLog).build(
        accountRepository.currentAccount(),
        enginePreferences.status(),
      )
    }

    AsyncFunction("pauseAsync") {
      workScheduler.pause()
      diagnosticLog.record(DiagnosticEventCode.ENGINE_PAUSED)
      engine.invalidate()
    }

    AsyncFunction("resumeAsync") {
      workScheduler.resume()
      diagnosticLog.record(DiagnosticEventCode.ENGINE_RESUMED)
      engine.invalidate()
    }

    AsyncFunction("scanNowAsync") {
      workScheduler.requestFullScan()
      diagnosticLog.record(DiagnosticEventCode.SCAN_REQUESTED)
      engine.invalidate()
    }

    AsyncFunction("getUploadDetailAsync") { jobId: String -> engine.uploadDetail(jobId) }

    AsyncFunction("retryUploadAsync") { jobId: String ->
      if (!engine.retryJob(jobId)) throw EngineInvalidInputException("Restore the account or folder access, then retry this file.")
      BlockerNotification(appContext.reactContext ?: throw AccountStorageException()).dismiss(jobId)
      workScheduler.requestQueueDrain()
    }

    AsyncFunction("retryFailedAsync") {
      engine.retryFailed()
      workScheduler.requestQueueDrain()
      diagnosticLog.record(DiagnosticEventCode.RETRY_REQUESTED)
    }

    AsyncFunction("clearCompletedHistoryAsync") {
      engine.clearCompletedHistory()
      diagnosticLog.record(DiagnosticEventCode.HISTORY_CLEARED)
    }

    AsyncFunction("setTransferConstraintsAsync") { input: TransferConstraintsRecord ->
      workScheduler.updateDrainConstraints(input.toConstraints())
      diagnosticLog.record(DiagnosticEventCode.CONSTRAINTS_CHANGED)
      engine.invalidate()
    }

    AsyncFunction("addOrUpdateSourceAsync") { source: SourceInputRecord ->
      val account = accountRepository.currentAccount() ?: throw AccountNotConfiguredException()
      engine.addOrUpdateSource(source, account.id)
      diagnosticLog.record(DiagnosticEventCode.SOURCE_CHANGED)
      workScheduler.ensureScheduled()
      workScheduler.requestQueueDrain()
    }

    AsyncFunction("removeSourceAsync") { sourceId: String ->
      sourceRemovalCleanup.remove(sourceId) {
        engine.removeSource(sourceId)
      }
      diagnosticLog.record(DiagnosticEventCode.SOURCE_CHANGED)
    }

    AsyncFunction("resetSourceHistoryAsync") { sourceId: String ->
      engine.resetSourceHistory(sourceId)
      diagnosticLog.record(DiagnosticEventCode.SOURCE_CHANGED)
      workScheduler.requestFullScan()
    }

    AsyncFunction("connectManualAsync") { input: ManualAccountInputRecord ->
      accountManager.connectManual(
        serverUrl = input.serverUrl,
        username = input.username,
        appPassword = input.appPassword,
      ).toMap()
    }

    AsyncFunction("replaceManualAccountAsync") { input: ManualAccountInputRecord ->
      EngineOperations.requireAvailable(engineDatabase.engineDao())
      accountManager.replaceManual(
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

    AsyncFunction("listRemoteFoldersAsync") Coroutine { pathSegments: List<String> ->
      withContext(Dispatchers.IO) { remoteFolderManager.list(pathSegments).map(RemoteFolder::toMap) }
    }

    AsyncFunction("createRemoteFolderAsync") Coroutine {
        parentPathSegments: List<String>, name: String ->
      withContext(Dispatchers.IO) {
        remoteFolderManager.create(parentPathSegments, name).also { folder ->
          if (folder.pathSegments == destinationChanges.root()) {
            accountRepository.credential()?.let { PhoneUploadReadme().write(it, null, onlyIfMissing = true, root = folder.pathSegments) }
          }
        }.toMap()
      }
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

    AsyncFunction("getMediaFoldersAsync") Coroutine { ->
      withContext(Dispatchers.IO) {
        val context = appContext.reactContext ?: throw AccountStorageException()
        AndroidMediaStoreDiscovery(context).folders().map { folder ->
          mapOf(
            "volumeName" to folder.volumeName, "relativePath" to folder.relativePath,
            "fileCount" to folder.fileCount, "totalBytes" to folder.totalBytes,
            "latestFileAt" to folder.latestFileAt?.let { java.time.Instant.ofEpochSecond(it).toString() },
          )
        }
      }
    }

    AsyncFunction("getLocalVideoThumbnailAsync") Coroutine { uri: String ->
      withContext(Dispatchers.IO) {
        LocalVideoPreview.thumbnail(appContext.reactContext ?: throw AccountStorageException(), uri)
      }
    }

    AsyncFunction("openLocalVideoAsync") { uri: String ->
      val context = appContext.reactContext ?: throw AccountStorageException()
      val parsed = Uri.parse(uri)
      require(parsed.scheme == "content")
      val intent = Intent(Intent.ACTION_VIEW).setDataAndType(parsed, "video/*")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("previewSourceAsync") Coroutine { selection: SourceSelectionRecord, offset: Int ->
      withContext(Dispatchers.IO) { sourceDiscoveryManager.preview(selection.toSelection(), offset).toMap() }
    }

    AsyncFunction("commitSourceAsync") { source: SourceCommitRecord ->
      sourceDiscoveryManager.commit(source.toCommit()).also { result ->
        diagnosticLog.record(DiagnosticEventCode.SOURCE_CHANGED)
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
