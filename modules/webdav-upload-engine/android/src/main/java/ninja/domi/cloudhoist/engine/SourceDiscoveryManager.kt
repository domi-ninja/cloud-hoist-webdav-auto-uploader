package ninja.domi.cloudhoist.engine

import java.util.UUID

enum class SourceType {
  CAMERA,
  SCREENSHOTS,
  DOCUMENT_TREE,
}

data class SourceSelection(
  val type: SourceType,
  val treeUri: String? = null,
)

data class SourceCommit(
  val id: String? = null,
  val name: String,
  val selection: SourceSelection,
  val remotePathSegments: List<String>,
  val collisionPolicy: CollisionPolicy = CollisionPolicy.REPLACE,
)

data class SourceCommitResult(
  val sourceId: String,
  val preview: SourcePreview,
  val jobsAdded: Int,
)

data class SourceScanResult(
  val sourceId: String,
  val preview: SourcePreview?,
  val revisionsAdded: Int,
  val jobsAdded: Int,
  val blocker: SourceAccessBlocker?,
)

class SourceDiscoveryManager(
  private val accountRepository: AccountRepository,
  private val recorder: SourceRevisionRecorder,
  private val mediaDiscovery: MediaPresetDiscovery,
  private val documentTreeDiscovery: DocumentTreeSourceDiscovery,
  private val newId: () -> String = { UUID.randomUUID().toString() },
  private val now: () -> Long = System::currentTimeMillis,
) {
  fun preview(selection: SourceSelection): SourcePreview = discover(selection).preview

  fun commit(input: SourceCommit): SourceCommitResult {
    val account = accountRepository.currentAccount() ?: throw AccountNotConfiguredException()
    if (input.name.isBlank()) throw EngineInvalidInputException("Source name is required.")
    val destination = DavPath.validate(input.remotePathSegments)
    val discovery = discover(input.selection)
    val sourceId = input.id ?: newId()
    val source = SourceEntity(
      id = sourceId,
      accountId = account.id,
      name = input.name.trim(),
      kind = if (input.selection.type == SourceType.DOCUMENT_TREE) "saf" else "media_store",
      localUri = input.selection.localUri(),
      remotePathSegments = destination,
      enabled = true,
      createdAt = now(),
      lastScanAt = null,
      blockerCode = null,
      collisionPolicy = input.collisionPolicy.value,
    )
    val recorded = recorder.record(
      source,
      discovery.files,
      queueNewRevisions = true,
      permissionAccess = discovery.permissionAccess,
    )
    return SourceCommitResult(sourceId, recorded.preview, recorded.jobsAdded)
  }

  fun scan(sourceId: String): SourceScanResult {
    val source = recorder.source(sourceId) ?: throw EngineSourceNotFoundException(sourceId)
    return try {
      val discovery = discover(source.selection())
      val recorded = recorder.record(
        source,
        discovery.files,
        queueNewRevisions = true,
        permissionAccess = discovery.permissionAccess,
        requireExisting = true,
      )
      SourceScanResult(
        sourceId = sourceId,
        preview = recorded.preview,
        revisionsAdded = recorded.revisionsAdded,
        jobsAdded = recorded.jobsAdded,
        blocker = null,
      )
    } catch (error: SourceAccessException) {
      recorder.markBlocked(sourceId, error.blocker)
      SourceScanResult(sourceId, null, 0, 0, error.blocker)
    }
  }

  private fun discover(selection: SourceSelection): SelectedSourceDiscovery = when (selection.type) {
    SourceType.CAMERA -> media(MediaPreset.CAMERA)
    SourceType.SCREENSHOTS -> media(MediaPreset.SCREENSHOTS)
    SourceType.DOCUMENT_TREE -> {
      val treeUri = selection.treeUri?.takeIf(String::isNotBlank)
        ?: throw EngineInvalidInputException("Choose a local folder first.")
      val files = documentTreeDiscovery.discover(treeUri)
      SelectedSourceDiscovery(files, null)
    }
  }

  private fun media(preset: MediaPreset): SelectedSourceDiscovery {
    val discovery = mediaDiscovery.discover(preset)
    if (discovery.permissionAccess == MediaPermissionAccess.DENIED) {
      throw SourceAccessException(
        SourceAccessBlocker.PERMISSION_REVOKED,
        "Allow photo and video access to use this source.",
      )
    }
    return SelectedSourceDiscovery(discovery.files, discovery.permissionAccess)
  }

  private fun SourceSelection.localUri() = when (type) {
    SourceType.CAMERA -> "mediastore://camera"
    SourceType.SCREENSHOTS -> "mediastore://screenshots"
    SourceType.DOCUMENT_TREE -> checkNotNull(treeUri)
  }

  private fun SourceEntity.selection(): SourceSelection = when {
    kind == "media_store" && localUri == "mediastore://camera" ->
      SourceSelection(SourceType.CAMERA)
    kind == "media_store" && localUri == "mediastore://screenshots" ->
      SourceSelection(SourceType.SCREENSHOTS)
    kind == "saf" -> SourceSelection(SourceType.DOCUMENT_TREE, localUri)
    else -> throw SourceAccessException(
      SourceAccessBlocker.FOLDER_UNAVAILABLE,
      "The local source configuration is invalid.",
    )
  }

  private data class SelectedSourceDiscovery(
    val files: List<DiscoveredFile>,
    val permissionAccess: MediaPermissionAccess?,
  ) {
    val preview: SourcePreview
      get() = files.toSourcePreview(permissionAccess)
  }
}
