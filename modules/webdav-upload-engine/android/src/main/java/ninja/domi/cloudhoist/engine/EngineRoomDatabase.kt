package ninja.domi.cloudhoist.engine

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.room.Upsert
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import org.json.JSONArray

object JobState {
  const val QUEUED = "queued"
  const val RUNNING = "running"
  const val RETRY_WAIT = "retry_wait"
  const val BLOCKED = "blocked"
  const val COMPLETED = "completed"
  const val CANCELLED = "cancelled"
}

data class PendingDiscoveryWrite(
  val revision: LocalRevisionEntity,
  val job: UploadJobEntity?,
)

data class DiscoveryWriteCounts(
  val revisionsAdded: Int,
  val jobsAdded: Int,
)

data class UploadJobView(
  val id: String,
  val sourceId: String,
  val remoteFileName: String,
  val state: String,
  val createdAt: Long,
  val startedAt: Long?,
  val completedAt: Long?,
  val retryAt: Long?,
  val lastErrorCode: String?,
  val byteCount: Long,
  val chunkSize: Long?,
  val confirmedChunks: List<String>?,
)

data class LocalInventoryView(
  val sourceId: String,
  val sourceName: String,
  val sourceRemotePathSegments: List<String>,
  val localUri: String,
  val localRelativePath: String,
  val mimeType: String?,
  val byteCount: Long,
  val modifiedAt: Long,
  val jobId: String?,
  val jobRemotePathSegments: List<String>?,
  val jobRemoteFileName: String?,
  val jobState: String?,
  val jobCompletedAt: Long?,
  val jobRetryAt: Long?,
  val jobLastErrorCode: String?,
)

class EngineTypeConverters {
  @TypeConverter
  fun encodeStringList(values: List<String>): String = JSONArray(values).toString()

  @TypeConverter
  fun decodeStringList(value: String): List<String> {
    val array = JSONArray(value)
    return List(array.length(), array::getString)
  }
}

@Dao
interface EngineDao {
  @Upsert
  fun upsertAccount(account: AccountEntity)

  @Upsert
  fun upsertSource(source: SourceEntity)

  @Insert(onConflict = OnConflictStrategy.IGNORE)
  fun insertRevision(revision: LocalRevisionEntity): Long

  @Query(
    """
    UPDATE local_revisions SET lastSeenAt = :lastSeenAt
    WHERE sourceId = :sourceId AND providerId = :providerId
      AND relativePath = :relativePath AND byteCount = :byteCount AND modifiedAt = :modifiedAt
    """,
  )
  fun touchRevision(
    sourceId: String,
    providerId: String,
    relativePath: String,
    byteCount: Long,
    modifiedAt: Long,
    lastSeenAt: Long,
  ): Int

  @Insert
  fun insertJob(job: UploadJobEntity)

  @Insert
  fun insertAttempt(attempt: UploadAttemptEntity)

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  fun upsertChunkCheckpoint(checkpoint: ChunkCheckpointEntity)

  @Query("SELECT * FROM upload_jobs WHERE id = :id")
  fun job(id: String): UploadJobEntity?

  @Query("UPDATE upload_jobs SET remoteFileName = :fileName WHERE id = :jobId")
  fun updateJobRemoteFileName(jobId: String, fileName: String): Int

  @Query("SELECT * FROM local_revisions WHERE id = :id")
  fun revision(id: String): LocalRevisionEntity?

  @Query("SELECT * FROM upload_jobs WHERE claimToken = :claimToken LIMIT 1")
  fun jobByClaimToken(claimToken: String): UploadJobEntity?

  @Query("SELECT COUNT(*) FROM upload_jobs WHERE revisionId = :revisionId")
  fun jobCountForRevision(revisionId: String): Int

  @Query("SELECT COUNT(*) FROM sources WHERE id = :sourceId")
  fun sourceCount(sourceId: String): Int

  @Query("SELECT * FROM sources WHERE id = :sourceId")
  fun source(sourceId: String): SourceEntity?

  @Query("SELECT * FROM sources ORDER BY createdAt ASC, id ASC")
  fun allSources(): List<SourceEntity>

  @Query("""
    SELECT MAX(upload_jobs.completedAt) FROM upload_jobs
    INNER JOIN sources ON sources.id = upload_jobs.sourceId
    WHERE upload_jobs.state = 'completed' AND sources.enabled = 1
      AND (sources.remotePathSegments = '["Phone Uploads"]' OR sources.remotePathSegments LIKE '["Phone Uploads",%')
  """)
  fun latestCompletedUploadInPhoneUploads(): Long?

  @Query("SELECT * FROM accounts WHERE blockerCode IS NOT NULL ORDER BY id ASC")
  fun blockedAccounts(): List<AccountEntity>

  @Query("SELECT * FROM sources WHERE blockerCode IS NOT NULL ORDER BY createdAt ASC, id ASC")
  fun blockedSources(): List<SourceEntity>

  @Query("SELECT COUNT(*) FROM upload_jobs WHERE state IN (:states)")
  fun jobCountInStates(states: List<String>): Int

  @Query("""
    SELECT
      COUNT(CASE WHEN state IN ('queued', 'retry_wait') THEN 1 END) AS queued,
      COUNT(CASE WHEN state = 'running' THEN 1 END) AS uploading,
      COUNT(CASE WHEN state = 'blocked' THEN 1 END) AS failed,
      COUNT(CASE WHEN state = 'completed' THEN 1 END) AS uploaded
    FROM upload_jobs WHERE sourceId IN (SELECT id FROM sources WHERE enabled = 1)
  """)
  fun queueCounts(): QueueCounts

  @Query("""
    SELECT sourceId,
      SUM(CASE WHEN state IN ('queued', 'running', 'retry_wait') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN state = 'blocked' THEN 1 ELSE 0 END) AS failed,
      COUNT(DISTINCT CASE WHEN state = 'completed' THEN remotePathSegments || '/' || remoteFileName END) AS uploaded
    FROM upload_jobs GROUP BY sourceId
  """)
  fun sourceQueueCounts(): List<SourceQueueCounts>

  @Query(
    """
    SELECT upload_jobs.id, upload_jobs.sourceId, upload_jobs.remoteFileName,
      upload_jobs.state, upload_jobs.createdAt, upload_jobs.startedAt,
      upload_jobs.completedAt, upload_jobs.retryAt, upload_jobs.lastErrorCode,
      local_revisions.byteCount, chunk_checkpoints.chunkSize,
      chunk_checkpoints.confirmedChunks
    FROM upload_jobs
    INNER JOIN local_revisions ON local_revisions.id = upload_jobs.revisionId
    LEFT JOIN chunk_checkpoints ON chunk_checkpoints.jobId = upload_jobs.id
    ORDER BY CASE WHEN upload_jobs.state = 'running' THEN 0 ELSE 1 END,
      upload_jobs.createdAt DESC, upload_jobs.id DESC
    LIMIT :limit
    """,
  )
  fun recentJobViews(limit: Int = 100): List<UploadJobView>

  @Query("""
    SELECT COALESCE(SUM(local_revisions.byteCount), 0) FROM upload_jobs
    INNER JOIN local_revisions ON local_revisions.id = upload_jobs.revisionId
    WHERE upload_jobs.state IN ('queued', 'running', 'retry_wait')
      AND upload_jobs.sourceId IN (SELECT id FROM sources WHERE enabled = 1)
  """)
  fun remainingUploadBytes(): Long

  @Query("""
    SELECT local_revisions.byteCount AS bytes,
      SUM(upload_attempts.finishedAt - upload_attempts.startedAt) AS durationMillis
    FROM upload_jobs
    INNER JOIN local_revisions ON local_revisions.id = upload_jobs.revisionId
    INNER JOIN upload_attempts ON upload_attempts.jobId = upload_jobs.id
    WHERE upload_jobs.state = 'completed' AND upload_jobs.completedAt >= :cutoff
      AND upload_jobs.sourceId IN (SELECT id FROM sources WHERE enabled = 1)
      AND upload_attempts.finishedAt > upload_attempts.startedAt
    GROUP BY upload_jobs.id ORDER BY upload_jobs.completedAt DESC LIMIT 20
  """)
  fun recentUploadTimings(cutoff: Long): List<UploadTiming>

  @Query("SELECT * FROM upload_jobs WHERE state IN ('blocked', 'retry_wait') ORDER BY createdAt ASC, id ASC")
  fun unresolvedJobs(): List<UploadJobEntity>

  @Query(
    """
    SELECT local_revisions.sourceId, sources.name AS sourceName,
      sources.remotePathSegments AS sourceRemotePathSegments,
      local_revisions.localUri, local_revisions.relativePath AS localRelativePath,
      local_revisions.mimeType, local_revisions.byteCount, local_revisions.modifiedAt,
      upload_jobs.id AS jobId, upload_jobs.remotePathSegments AS jobRemotePathSegments,
      upload_jobs.remoteFileName AS jobRemoteFileName, upload_jobs.state AS jobState,
      upload_jobs.completedAt AS jobCompletedAt, upload_jobs.retryAt AS jobRetryAt,
      upload_jobs.lastErrorCode AS jobLastErrorCode
    FROM local_revisions
    INNER JOIN sources ON sources.id = local_revisions.sourceId
    LEFT JOIN upload_jobs ON upload_jobs.revisionId = local_revisions.id
    WHERE sources.lastScanAt IS NOT NULL
      AND local_revisions.lastSeenAt = sources.lastScanAt
    ORDER BY local_revisions.modifiedAt DESC, local_revisions.id DESC
    """,
  )
  fun localInventory(): List<LocalInventoryView>

  @Query(
    "SELECT * FROM upload_attempts WHERE startedAt >= :cutoff " +
      "ORDER BY startedAt DESC, id DESC LIMIT :limit OFFSET :offset",
  )
  fun activityAttempts(
    cutoff: Long,
    limit: Int,
    offset: Int,
  ): List<UploadAttemptEntity>

  @Query(
    "SELECT * FROM sources WHERE enabled = 1 AND (:kind IS NULL OR kind = :kind) " +
      "ORDER BY createdAt ASC, id ASC",
  )
  fun enabledSources(kind: String? = null): List<SourceEntity>

  @Query(
    "UPDATE sources SET blockerCode = :blockerCode, lastScanAt = :scannedAt WHERE id = :sourceId",
  )
  fun markSourceBlocked(sourceId: String, blockerCode: String, scannedAt: Long): Int

  @Query("SELECT COUNT(*) FROM accounts")
  fun accountCount(): Int

  @Query("SELECT * FROM accounts WHERE id = :accountId")
  fun account(accountId: String): AccountEntity?

  @Query("SELECT COUNT(*) FROM local_revisions")
  fun revisionCount(): Int

  @Query("SELECT COUNT(*) FROM upload_jobs")
  fun jobCount(): Int

  @Query("SELECT COUNT(*) FROM upload_attempts WHERE jobId = :jobId")
  fun attemptCount(jobId: String): Int

  @Query(
    "SELECT COUNT(*) FROM upload_jobs " +
      "INNER JOIN sources ON sources.id = upload_jobs.sourceId " +
      "INNER JOIN accounts ON accounts.id = upload_jobs.accountId " +
      "WHERE sources.enabled = 1 AND sources.blockerCode IS NULL " +
      "AND accounts.blockerCode IS NULL AND " +
      "(upload_jobs.state = 'queued' OR " +
      "(upload_jobs.state = 'retry_wait' AND upload_jobs.retryAt <= :now))",
  )
  fun eligibleJobCount(now: Long): Int

  @Query("""
    SELECT COUNT(*) FROM upload_jobs
    INNER JOIN sources ON sources.id = upload_jobs.sourceId
    INNER JOIN accounts ON accounts.id = upload_jobs.accountId
    WHERE sources.enabled = 1 AND sources.blockerCode IS NULL AND accounts.blockerCode IS NULL
      AND upload_jobs.state IN ('queued', 'retry_wait', 'running')
  """)
  fun pendingWorkCount(): Int

  @Query("""
    SELECT upload_jobs.* FROM upload_jobs
    INNER JOIN sources ON sources.id = upload_jobs.sourceId
    INNER JOIN accounts ON accounts.id = upload_jobs.accountId
    WHERE sources.enabled = 1 AND sources.blockerCode IS NULL AND accounts.blockerCode IS NULL
      AND upload_jobs.state = 'retry_wait'
    ORDER BY upload_jobs.retryAt ASC LIMIT 1
  """)
  fun nextRetryJob(): UploadJobEntity?

  @Query("""
    UPDATE upload_jobs SET state = 'queued', claimToken = NULL, startedAt = NULL, retryAt = NULL,
      attemptCount = MAX(0, attemptCount - 1)
    WHERE state = 'running' AND (claimToken IS NULL OR claimToken NOT LIKE :processPattern)
  """)
  fun recoverForeignProcessClaims(processPattern: String): Int

  @Query("SELECT * FROM chunk_checkpoints WHERE jobId = :jobId")
  fun chunkCheckpoint(jobId: String): ChunkCheckpointEntity?

  @Query(
    """
    SELECT chunk_checkpoints.uploadId, local_revisions.localUri,
      upload_jobs.remotePathSegments, upload_jobs.remoteFileName,
      local_revisions.byteCount, local_revisions.mimeType,
      local_revisions.modifiedAt, local_revisions.createdAt
    FROM chunk_checkpoints
    INNER JOIN upload_jobs ON upload_jobs.id = chunk_checkpoints.jobId
    INNER JOIN local_revisions ON local_revisions.id = upload_jobs.revisionId
    ORDER BY chunk_checkpoints.updatedAt ASC, chunk_checkpoints.uploadId ASC
    """,
  )
  fun chunkSessions(): List<ChunkSessionRecord>

  @Query("DELETE FROM chunk_checkpoints WHERE jobId = :jobId")
  fun deleteChunkCheckpoint(jobId: String): Int

  @Query(
    """
    UPDATE upload_jobs
    SET state = 'running', startedAt = :now, claimToken = :claimToken,
        attemptCount = attemptCount + 1, retryAt = NULL
    WHERE id = (
      SELECT upload_jobs.id FROM upload_jobs
      INNER JOIN sources ON sources.id = upload_jobs.sourceId
      INNER JOIN accounts ON accounts.id = upload_jobs.accountId
      WHERE sources.enabled = 1
        AND sources.blockerCode IS NULL
        AND accounts.blockerCode IS NULL
        AND (
          upload_jobs.state = 'queued'
          OR (upload_jobs.state = 'retry_wait' AND upload_jobs.retryAt <= :now)
        )
      ORDER BY upload_jobs.createdAt ASC, upload_jobs.id ASC
      LIMIT 1
    )
    AND (state = 'queued' OR (state = 'retry_wait' AND retryAt <= :now))
    """,
  )
  fun markNextEligibleRunning(now: Long, claimToken: String): Int

  @Query(
    """
    UPDATE upload_jobs
    SET state = 'queued', startedAt = NULL, claimToken = NULL,
        lastErrorCode = 'process_died', attemptCount = MAX(0, attemptCount - 1)
    WHERE state = 'running' AND startedAt < :startedBefore
    """,
  )
  fun recoverAbandoned(startedBefore: Long): Int

  @Query(
    """
    UPDATE upload_jobs
    SET state = 'completed', completedAt = :completedAt, startedAt = NULL,
        claimToken = NULL, blockerCode = NULL, lastErrorCode = NULL
    WHERE id = :jobId AND state = 'running' AND claimToken = :claimToken
    """,
  )
  fun completeClaim(jobId: String, claimToken: String, completedAt: Long): Int

  @Query(
    """
    UPDATE upload_jobs
    SET state = 'retry_wait', retryAt = :retryAt, startedAt = NULL,
        claimToken = NULL, lastErrorCode = :errorCode
    WHERE id = :jobId AND state = 'running' AND claimToken = :claimToken
    """,
  )
  fun retryClaim(jobId: String, claimToken: String, retryAt: Long, errorCode: String): Int

  @Query(
    """
    UPDATE upload_jobs
    SET state = 'blocked', blockerCode = :blockerCode, startedAt = NULL,
        claimToken = NULL, lastErrorCode = :errorCode
    WHERE id = :jobId AND state = 'running' AND claimToken = :claimToken
    """,
  )
  fun blockClaim(jobId: String, claimToken: String, blockerCode: String, errorCode: String): Int

  @Query("""
    UPDATE upload_jobs SET state = 'retry_wait', retryAt = :now, startedAt = NULL,
      claimToken = NULL, attemptCount = MAX(0, attemptCount - 1), lastErrorCode = 'cancelled'
    WHERE id = :jobId AND state = 'running' AND claimToken = :claimToken
  """)
  fun releaseCancelledClaim(jobId: String, claimToken: String, now: Long): Int

  @Query("""
    UPDATE upload_jobs SET state = 'queued', retryAt = NULL, blockerCode = NULL,
      lastErrorCode = NULL, attemptCount = 0
    WHERE id = :jobId AND state IN ('blocked', 'retry_wait')
      AND accountId IN (SELECT id FROM accounts WHERE blockerCode IS NULL)
      AND sourceId IN (SELECT id FROM sources WHERE enabled = 1 AND blockerCode IS NULL)
  """)
  fun retryJob(jobId: String): Int

  @Query("UPDATE accounts SET blockerCode = :blockerCode WHERE id = :accountId")
  fun markAccountBlocked(accountId: String, blockerCode: String): Int

  @Query("UPDATE sources SET blockerCode = :blockerCode WHERE id = :sourceId")
  fun markSourceBlocked(sourceId: String, blockerCode: String): Int

  @Query("DELETE FROM upload_jobs WHERE state = 'completed' AND completedAt < :cutoff")
  fun deleteCompletedBefore(cutoff: Long): Int

  @Query("DELETE FROM sources WHERE id = :sourceId")
  fun deleteSourceById(sourceId: String): Int

  @Query("DELETE FROM local_revisions WHERE sourceId = :sourceId")
  fun deleteRevisionsForSource(sourceId: String): Int

  @Query("UPDATE sources SET lastScanAt = NULL, blockerCode = NULL WHERE id = :sourceId")
  fun resetSourceScan(sourceId: String): Int

  @Query(
    """
    UPDATE upload_jobs
    SET state = 'queued', retryAt = NULL, blockerCode = NULL, lastErrorCode = NULL, attemptCount = 0
    WHERE (state = 'blocked' OR state = 'retry_wait')
      AND accountId IN (SELECT id FROM accounts WHERE blockerCode IS NULL)
      AND sourceId IN (SELECT id FROM sources WHERE enabled = 1 AND blockerCode IS NULL)
    """,
  )
  fun retryEligibleFailures(): Int

  @Query("DELETE FROM accounts")
  fun deleteAllAccounts(): Int

  @Transaction
  fun enqueueRevision(revision: LocalRevisionEntity, job: UploadJobEntity): Boolean {
    if (insertRevision(revision) == -1L) return false
    insertJob(job)
    return true
  }

  @Transaction
  fun claimNext(now: Long, claimToken: String): UploadJobEntity? {
    if (markNextEligibleRunning(now, claimToken) != 1) return null
    return jobByClaimToken(claimToken)
  }

  @Transaction
  fun blockAccountClaim(
    jobId: String,
    claimToken: String,
    accountId: String,
    blockerCode: String,
    errorCode: String,
  ): Boolean {
    if (blockClaim(jobId, claimToken, blockerCode, errorCode) != 1) return false
    return markAccountBlocked(accountId, blockerCode) == 1
  }

  @Transaction
  fun blockSourceClaim(
    jobId: String,
    claimToken: String,
    sourceId: String,
    blockerCode: String,
    errorCode: String,
  ): Boolean {
    if (blockClaim(jobId, claimToken, blockerCode, errorCode) != 1) return false
    return markSourceBlocked(sourceId, blockerCode) == 1
  }

  @Transaction
  fun removeSource(sourceId: String): Boolean = deleteSourceById(sourceId) == 1

  @Transaction
  fun resetSourceHistory(sourceId: String): Boolean {
    if (source(sourceId) == null) return false
    deleteRevisionsForSource(sourceId)
    return resetSourceScan(sourceId) == 1
  }

  @Transaction
  fun wipe() {
    deleteAllAccounts()
  }

  @Transaction
  fun recordDiscovery(
    source: SourceEntity,
    writes: List<PendingDiscoveryWrite>,
  ): DiscoveryWriteCounts {
    upsertSource(source)
    var revisionsAdded = 0
    var jobsAdded = 0
    for (write in writes) {
      if (insertRevision(write.revision) == -1L) {
        val revision = write.revision
        touchRevision(
          revision.sourceId,
          revision.providerId,
          revision.relativePath,
          revision.byteCount,
          revision.modifiedAt,
          revision.lastSeenAt,
        )
        continue
      }
      revisionsAdded += 1
      write.job?.let {
        insertJob(it)
        jobsAdded += 1
      }
    }
    return DiscoveryWriteCounts(revisionsAdded, jobsAdded)
  }

  @Transaction
  fun recordExistingDiscovery(
    source: SourceEntity,
    writes: List<PendingDiscoveryWrite>,
  ): DiscoveryWriteCounts? {
    if (source(source.id) == null) return null
    return recordDiscovery(source, writes)
  }
}

@Database(
  entities = [
    AccountEntity::class,
    SourceEntity::class,
    LocalRevisionEntity::class,
    UploadJobEntity::class,
    UploadAttemptEntity::class,
    ChunkCheckpointEntity::class,
  ],
  version = 6,
  exportSchema = true,
)
@TypeConverters(EngineTypeConverters::class)
abstract class EngineRoomDatabase : RoomDatabase() {
  abstract fun engineDao(): EngineDao

  companion object {
    @Volatile
    private var instance: EngineRoomDatabase? = null

    fun open(context: Context): EngineRoomDatabase = instance ?: synchronized(this) {
      instance ?: Room.databaseBuilder(
        context.applicationContext,
        EngineRoomDatabase::class.java,
        "webdav-upload-engine.db",
      ).addMigrations(
        MIGRATION_1_2,
        MIGRATION_2_3,
        MIGRATION_3_4,
        MIGRATION_4_5,
        MIGRATION_5_6,
      ).build()
        .also { instance = it }
    }

    val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
          """
          CREATE TABLE upload_jobs_new (
            id TEXT NOT NULL PRIMARY KEY,
            accountId TEXT NOT NULL,
            sourceId TEXT NOT NULL,
            revisionId TEXT NOT NULL,
            remotePathSegments TEXT NOT NULL,
            remoteFileName TEXT NOT NULL,
            state TEXT NOT NULL,
            createdAt INTEGER NOT NULL,
            startedAt INTEGER,
            completedAt INTEGER,
            retryAt INTEGER,
            attemptCount INTEGER NOT NULL,
            claimToken TEXT,
            blockerCode TEXT,
            lastErrorCode TEXT,
            FOREIGN KEY(accountId) REFERENCES accounts(id) ON UPDATE NO ACTION ON DELETE CASCADE,
            FOREIGN KEY(sourceId) REFERENCES sources(id) ON UPDATE NO ACTION ON DELETE CASCADE,
            FOREIGN KEY(revisionId) REFERENCES local_revisions(id) ON UPDATE NO ACTION ON DELETE CASCADE
          )
          """.trimIndent(),
        )
        database.execSQL(
          """
          INSERT INTO upload_jobs_new
          SELECT upload_jobs.id, sources.accountId, upload_jobs.sourceId, upload_jobs.revisionId,
            upload_jobs.remotePathSegments, upload_jobs.remoteFileName, upload_jobs.state,
            upload_jobs.createdAt, upload_jobs.startedAt, upload_jobs.completedAt,
            upload_jobs.retryAt, upload_jobs.attemptCount, upload_jobs.claimToken,
            upload_jobs.blockerCode, upload_jobs.lastErrorCode
          FROM upload_jobs
          INNER JOIN sources ON sources.id = upload_jobs.sourceId
          """.trimIndent(),
        )
        database.execSQL("CREATE TEMP TABLE upload_attempts_backup AS SELECT * FROM upload_attempts")
        database.execSQL("CREATE TEMP TABLE chunk_checkpoints_backup AS SELECT * FROM chunk_checkpoints")
        database.execSQL("DROP TABLE upload_attempts")
        database.execSQL("DROP TABLE chunk_checkpoints")
        database.execSQL("DROP TABLE upload_jobs")
        database.execSQL("ALTER TABLE upload_jobs_new RENAME TO upload_jobs")
        database.execSQL(
          """
          CREATE TABLE upload_attempts (
            id TEXT NOT NULL PRIMARY KEY,
            jobId TEXT NOT NULL,
            startedAt INTEGER NOT NULL,
            finishedAt INTEGER,
            resultCode TEXT,
            FOREIGN KEY(jobId) REFERENCES upload_jobs(id) ON UPDATE NO ACTION ON DELETE CASCADE
          )
          """.trimIndent(),
        )
        database.execSQL(
          "INSERT INTO upload_attempts SELECT id, jobId, startedAt, finishedAt, resultCode FROM upload_attempts_backup",
        )
        database.execSQL(
          """
          CREATE TABLE chunk_checkpoints (
            uploadId TEXT NOT NULL PRIMARY KEY,
            jobId TEXT NOT NULL,
            chunkSize INTEGER NOT NULL,
            confirmedChunks TEXT NOT NULL,
            updatedAt INTEGER NOT NULL,
            FOREIGN KEY(jobId) REFERENCES upload_jobs(id) ON UPDATE NO ACTION ON DELETE CASCADE
          )
          """.trimIndent(),
        )
        database.execSQL(
          "INSERT INTO chunk_checkpoints SELECT uploadId, jobId, chunkSize, confirmedChunks, updatedAt FROM chunk_checkpoints_backup",
        )
        database.execSQL("DROP TABLE upload_attempts_backup")
        database.execSQL("DROP TABLE chunk_checkpoints_backup")
        database.execSQL("CREATE INDEX index_upload_jobs_accountId ON upload_jobs(accountId)")
        database.execSQL("CREATE INDEX index_upload_jobs_sourceId ON upload_jobs(sourceId)")
        database.execSQL("CREATE UNIQUE INDEX index_upload_jobs_revisionId ON upload_jobs(revisionId)")
        database.execSQL("CREATE INDEX index_upload_jobs_claimToken ON upload_jobs(claimToken)")
        database.execSQL("CREATE INDEX index_upload_attempts_jobId ON upload_attempts(jobId)")
        database.execSQL("CREATE UNIQUE INDEX index_chunk_checkpoints_jobId ON chunk_checkpoints(jobId)")
      }
    }

    val MIGRATION_2_3 = object : Migration(2, 3) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE accounts ADD COLUMN blockerCode TEXT")
      }
    }

    val MIGRATION_3_4 = object : Migration(3, 4) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE local_revisions ADD COLUMN mimeType TEXT")
        database.execSQL("ALTER TABLE local_revisions ADD COLUMN createdAt INTEGER")
      }
    }

    val MIGRATION_4_5 = object : Migration(4, 5) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
          "ALTER TABLE sources ADD COLUMN collisionPolicy TEXT NOT NULL DEFAULT 'replace'",
        )
      }
    }

    val MIGRATION_5_6 = object : Migration(5, 6) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
          "ALTER TABLE local_revisions ADD COLUMN lastSeenAt INTEGER NOT NULL DEFAULT 0",
        )
        database.execSQL("UPDATE local_revisions SET lastSeenAt = discoveredAt")
      }
    }
  }
}
