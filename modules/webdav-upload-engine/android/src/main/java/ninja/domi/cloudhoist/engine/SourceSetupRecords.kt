package ninja.domi.cloudhoist.engine

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SourceSelectionRecord : Record {
  @Field
  val type: String = ""

  @Field
  val treeUri: String? = null

  @Field
  val volumeName: String? = null

  @Field
  val relativePath: String? = null

  fun toSelection() = SourceSelection(
    type = when (type) {
      "camera" -> SourceType.CAMERA
      "screenshots" -> SourceType.SCREENSHOTS
      "document_tree" -> SourceType.DOCUMENT_TREE
      "media_folder" -> SourceType.MEDIA_FOLDER
      else -> throw EngineInvalidInputException("Source type is invalid.")
    },
    treeUri = treeUri,
    volumeName = volumeName,
    relativePath = relativePath,
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
  val collisionPolicy: String = CollisionPolicy.REPLACE.value

  fun toCommit() = SourceCommit(
    id = id,
    name = name,
    selection = selection.toSelection(),
    remotePathSegments = remotePathSegments,
    collisionPolicy = CollisionPolicy.fromValue(collisionPolicy),
  )
}

fun SourcePreview.toMap(): Map<String, Any?> = mapOf(
  "eligibleFileCount" to eligibleFileCount,
  "totalBytes" to totalBytes,
  "permissionAccess" to permissionAccess?.name?.lowercase(),
  "nextOffset" to nextOffset,
  "files" to files.map { file ->
    mapOf(
      "localUri" to file.localUri,
      "fileName" to file.fileName,
      "mimeType" to file.mimeType,
    )
  },
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
