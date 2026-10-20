package ninja.domi.cloudhoist.engine

import androidx.room.Entity
import androidx.room.ColumnInfo
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

data class SourceQueueCounts(val sourceId: String, val pending: Int, val failed: Int)

data class QueueCounts(val queued: Int, val uploading: Int, val failed: Int, val uploaded: Int)

@Entity(tableName = "accounts")
data class AccountEntity(
  @PrimaryKey val id: String,
  val serverUrl: String,
  val loginName: String,
  val davUserId: String,
  val displayName: String,
  val checkedAt: Long,
  val serverVersion: String,
  val chunkingSupported: Boolean,
  val maxChunkSize: Long?,
  val credentialReference: String,
  val blockerCode: String? = null,
)

@Entity(
  tableName = "sources",
  foreignKeys = [
    ForeignKey(
      entity = AccountEntity::class,
      parentColumns = ["id"],
      childColumns = ["accountId"],
      onDelete = ForeignKey.CASCADE,
    ),
  ],
  indices = [Index("accountId")],
)
data class SourceEntity(
  @PrimaryKey val id: String,
  val accountId: String,
  val name: String,
  val kind: String,
  val localUri: String,
  val remotePathSegments: List<String>,
  val enabled: Boolean,
  val createdAt: Long,
  val lastScanAt: Long?,
  val blockerCode: String?,
  val collisionPolicy: String = CollisionPolicy.REPLACE.value,
)

@Entity(
  tableName = "local_revisions",
  foreignKeys = [
    ForeignKey(
      entity = SourceEntity::class,
      parentColumns = ["id"],
      childColumns = ["sourceId"],
      onDelete = ForeignKey.CASCADE,
    ),
  ],
  indices = [
    Index("sourceId"),
    Index(
      value = ["sourceId", "providerId", "relativePath", "byteCount", "modifiedAt"],
      unique = true,
    ),
  ],
)
data class LocalRevisionEntity(
  @PrimaryKey val id: String,
  val sourceId: String,
  val providerId: String,
  val localUri: String,
  val relativePath: String,
  val byteCount: Long,
  val modifiedAt: Long,
  val discoveredAt: Long,
  val mimeType: String? = null,
  val createdAt: Long? = null,
  @ColumnInfo(defaultValue = "0") val lastSeenAt: Long = discoveredAt,
)

@Entity(
  tableName = "upload_jobs",
  foreignKeys = [
    ForeignKey(
      entity = SourceEntity::class,
      parentColumns = ["id"],
      childColumns = ["sourceId"],
      onDelete = ForeignKey.CASCADE,
    ),
    ForeignKey(
      entity = LocalRevisionEntity::class,
      parentColumns = ["id"],
      childColumns = ["revisionId"],
      onDelete = ForeignKey.CASCADE,
    ),
    ForeignKey(
      entity = AccountEntity::class,
      parentColumns = ["id"],
      childColumns = ["accountId"],
      onDelete = ForeignKey.CASCADE,
    ),
  ],
  indices = [
    Index("accountId"),
    Index("sourceId"),
    Index(value = ["revisionId"], unique = true),
    Index("claimToken"),
  ],
)
data class UploadJobEntity(
  @PrimaryKey val id: String,
  val accountId: String,
  val sourceId: String,
  val revisionId: String,
  val remotePathSegments: List<String>,
  val remoteFileName: String,
  val state: String,
  val createdAt: Long,
  val startedAt: Long?,
  val completedAt: Long?,
  val retryAt: Long?,
  val attemptCount: Int,
  val claimToken: String?,
  val blockerCode: String?,
  val lastErrorCode: String?,
)

@Entity(
  tableName = "upload_attempts",
  foreignKeys = [
    ForeignKey(
      entity = UploadJobEntity::class,
      parentColumns = ["id"],
      childColumns = ["jobId"],
      onDelete = ForeignKey.CASCADE,
    ),
  ],
  indices = [Index("jobId")],
)
data class UploadAttemptEntity(
  @PrimaryKey val id: String,
  val jobId: String,
  val startedAt: Long,
  val finishedAt: Long?,
  val resultCode: String?,
)

@Entity(
  tableName = "chunk_checkpoints",
  foreignKeys = [
    ForeignKey(
      entity = UploadJobEntity::class,
      parentColumns = ["id"],
      childColumns = ["jobId"],
      onDelete = ForeignKey.CASCADE,
    ),
  ],
  indices = [Index(value = ["jobId"], unique = true)],
)
data class ChunkCheckpointEntity(
  @PrimaryKey val uploadId: String,
  val jobId: String,
  val chunkSize: Long,
  val confirmedChunks: List<String>,
  val updatedAt: Long,
)

data class ChunkSessionRecord(
  val uploadId: String,
  val localUri: String,
  val remotePathSegments: List<String>,
  val remoteFileName: String,
  val byteCount: Long,
  val mimeType: String?,
  val modifiedAt: Long,
  val createdAt: Long?,
)
