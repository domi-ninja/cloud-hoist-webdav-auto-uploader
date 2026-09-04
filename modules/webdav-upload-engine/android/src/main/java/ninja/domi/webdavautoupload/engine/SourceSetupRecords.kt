package ninja.domi.webdavautoupload.engine

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SourceSelectionRecord : Record {
  @Field
  val type: String = ""

  @Field
  val treeUri: String? = null

  fun toSelection() = SourceSelection(
    type = when (type) {
      "camera" -> SourceType.CAMERA
      "screenshots" -> SourceType.SCREENSHOTS
      "document_tree" -> SourceType.DOCUMENT_TREE
      else -> throw EngineInvalidInputException("Source type is invalid.")
    },
    treeUri = treeUri,
  )
}

class SourceCommitRecord : Record {
  @Field
  val id: String? = null

  @Field
  val name: String = ""

  @Field
  val selection: SourceSelectionRecord = SourceSelectionRecord()

  @Field
  val remotePathSegments: List<String> = emptyList()

  @Field
  val includeExisting: Boolean = false

  fun toCommit() = SourceCommit(
    id = id,
    name = name,
    selection = selection.toSelection(),
    remotePathSegments = remotePathSegments,
    includeExisting = includeExisting,
  )
}

fun SourcePreview.toMap(): Map<String, Any?> = mapOf(
  "eligibleFileCount" to eligibleFileCount,
  "totalBytes" to totalBytes,
  "permissionAccess" to permissionAccess?.name?.lowercase(),
)

fun SourceCommitResult.toMap(): Map<String, Any?> = mapOf(
  "sourceId" to sourceId,
  "preview" to preview.toMap(),
  "jobsAdded" to jobsAdded,
)

fun SourceScanResult.toMap(): Map<String, Any?> = mapOf(
  "sourceId" to sourceId,
  "preview" to preview?.toMap(),
  "revisionsAdded" to revisionsAdded,
  "jobsAdded" to jobsAdded,
  "blocker" to blocker?.name?.lowercase(),
)
