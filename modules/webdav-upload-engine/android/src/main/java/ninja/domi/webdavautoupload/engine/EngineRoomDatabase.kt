package ninja.domi.webdavautoupload.engine

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
import org.json.JSONArray

object JobState {
  const val QUEUED = "queued"
  const val RUNNING = "running"
  const val RETRY_WAIT = "retry_wait"
  const val BLOCKED = "blocked"
  const val COMPLETED = "completed"
  const val CANCELLED = "cancelled"
}

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

  @Insert
  fun insertJob(job: UploadJobEntity)

  @Insert
  fun insertAttempt(attempt: UploadAttemptEntity)

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  fun upsertChunkCheckpoint(checkpoint: ChunkCheckpointEntity)

  @Query("SELECT * FROM upload_jobs WHERE id = :id")
  fun job(id: String): UploadJobEntity?

  @Query("SELECT * FROM upload_jobs WHERE claimToken = :claimToken LIMIT 1")
  fun jobByClaimToken(claimToken: String): UploadJobEntity?

  @Query("SELECT COUNT(*) FROM upload_jobs WHERE revisionId = :revisionId")
  fun jobCountForRevision(revisionId: String): Int

  @Query("SELECT COUNT(*) FROM sources WHERE id = :sourceId")
  fun sourceCount(sourceId: String): Int

  @Query("SELECT COUNT(*) FROM accounts")
  fun accountCount(): Int

  @Query("SELECT COUNT(*) FROM local_revisions")
  fun revisionCount(): Int

  @Query("SELECT COUNT(*) FROM upload_jobs")
  fun jobCount(): Int

  @Query(
    """
    UPDATE upload_jobs
    SET state = 'running', startedAt = :now, claimToken = :claimToken,
        attemptCount = attemptCount + 1, retryAt = NULL
    WHERE id = (
      SELECT id FROM upload_jobs
      WHERE state = 'queued' OR (state = 'retry_wait' AND retryAt <= :now)
      ORDER BY createdAt ASC, id ASC
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
        lastErrorCode = 'process_died'
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

  @Query("DELETE FROM upload_jobs WHERE state = 'completed' AND completedAt < :cutoff")
  fun deleteCompletedBefore(cutoff: Long): Int

  @Query("DELETE FROM sources WHERE id = :sourceId")
  fun deleteSourceById(sourceId: String): Int

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
  fun removeSource(sourceId: String): Boolean = deleteSourceById(sourceId) == 1

  @Transaction
  fun wipe() {
    deleteAllAccounts()
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
  version = 1,
  exportSchema = true,
)
@TypeConverters(EngineTypeConverters::class)
abstract class EngineRoomDatabase : RoomDatabase() {
  abstract fun engineDao(): EngineDao

  companion object {
    fun open(context: Context): EngineRoomDatabase = Room.databaseBuilder(
      context.applicationContext,
      EngineRoomDatabase::class.java,
      "webdav-upload-engine.db",
    ).build()
  }
}
