package ninja.domi.cloudhoist.engine

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.UUID
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock
import org.json.JSONArray
import org.json.JSONObject

/** Serializes destination changes with discovery and transfers, including headless workers. */
object EngineOperations {
  val lock = ReentrantLock(true)
  @Volatile var destinationRequested = false
  fun held(dao: EngineDao) = destinationRequested || dao.setting(DESTINATION_CHANGE)?.let { DestinationOperation.read(it).state != "completed" } == true
  fun requireAvailable(dao: EngineDao) {
    if (held(dao)) throw EngineInvalidInputException("Finish the destination change before editing backups.")
  }
}

const val DESTINATION_CHANGE = "destination_change"
const val BACKUP_ROOT = "backup_root"

internal fun List<String>.under(root: List<String>) = take(root.size) == root
internal fun destinationUnderNewRoot(path: List<String>, oldRoot: List<String>, newRoot: List<String>): List<String> {
  // Older versions changed the preference without moving existing Cloud Hoist destinations.
  val suffix = when {
    path.under(oldRoot) -> path.drop(oldRoot.size)
    path.firstOrNull() in setOf("Cloud Hoist", "Phone Uploads") -> path.drop(1)
    else -> path // Preserve the complete custom path when it was outside the previous root.
  }
  return newRoot + suffix
}

class DestinationChangeRequest : Record {
  @Field var sourceId: String? = null
  @Field var pathSegments: List<String> = emptyList()
  @Field var rootChange: Boolean = false
}

data class DestinationRoute(val sourceId: String, val name: String, val from: List<String>, val to: List<String>) {
  fun json() = JSONObject().put("sourceId", sourceId).put("name", name)
    .put("from", JSONArray(from)).put("to", JSONArray(to))
}

data class DestinationFile(
  val sourceId: String, val revisionId: String, val jobId: String?,
  val from: List<String>, var to: List<String>,
  var etag: String? = null, var attempted: Boolean = false, var done: Boolean = false, var present: Boolean = false,
  val localAvailable: Boolean = true,
  var duplicateEtag: String? = null,
  val originalTo: List<String> = to,
)

/** One durable journal, retained on failure and acknowledged only after the UI sees completion. */
data class DestinationOperation(
  val id: String, val routes: List<DestinationRoute>, val files: List<DestinationFile>,
  val root: List<String>?, var mode: String, var state: String = "running",
  var message: String? = null, var errorSourceId: String? = null, var errorFile: String? = null,
) {
  fun json(): JSONObject = JSONObject().put("id", id).put("routes", JSONArray(routes.map { it.json() }))
    .put("root", root?.let(::JSONArray) ?: JSONObject.NULL).put("mode", mode).put("state", state)
    .put("message", message).put("errorSourceId", errorSourceId).put("errorFile", errorFile)
    .put("files", JSONArray(files.map { file -> JSONObject()
      .put("sourceId", file.sourceId).put("revisionId", file.revisionId).put("jobId", file.jobId)
      .put("from", JSONArray(file.from)).put("to", JSONArray(file.to)).put("etag", file.etag).put("localAvailable", file.localAvailable)
      .put("duplicateEtag", file.duplicateEtag).put("originalTo", JSONArray(file.originalTo))
      .put("attempted", file.attempted).put("done", file.done).put("present", file.present)
    }))

  fun summary(): Map<String, Any?> = mapOf(
    "id" to id, "state" to state, "mode" to mode,
    "routes" to routes.map { mapOf("sourceId" to it.sourceId, "name" to it.name, "from" to it.from, "to" to it.to) },
    "total" to files.size, "processed" to files.count { it.done },
    "message" to message, "errorSourceId" to errorSourceId, "errorFile" to errorFile,
    "root" to root,
  )

  companion object {
    fun read(value: String): DestinationOperation {
      val json = JSONObject(value)
      val routes = json.getJSONArray("routes").objects().map {
        DestinationRoute(it.getString("sourceId"), it.getString("name"), it.path("from"), it.path("to"))
      }
      val files = json.getJSONArray("files").objects().map {
        DestinationFile(it.getString("sourceId"), it.getString("revisionId"), it.nullableString("jobId"),
          it.path("from"), it.path("to"), it.nullableString("etag"), it.optBoolean("attempted"), it.getBoolean("done"), it.getBoolean("present"), it.optBoolean("localAvailable", true), it.nullableString("duplicateEtag"),
          if (it.has("originalTo")) it.path("originalTo") else it.path("to"))
      }
      return DestinationOperation(json.getString("id"), routes, files,
        if (json.isNull("root")) null else json.path("root"), json.getString("mode"), json.getString("state"),
        json.nullableString("message"), json.nullableString("errorSourceId"), json.nullableString("errorFile"))
    }
  }
}
private fun JSONObject.path(key: String) = getJSONArray(key).let { a -> List(a.length(), a::getString) }
private fun JSONObject.nullableString(key: String) = if (isNull(key)) null else getString(key)
private fun JSONArray.objects() = List(length(), ::getJSONObject)

interface DestinationNetworkClient {
  fun reset() = Unit
  fun etag(credential: StoredAccountCredential, path: List<String>): String?
  fun hash(credential: StoredAccountCredential, path: List<String>, etag: String): String?
  fun deleteDuplicate(credential: StoredAccountCredential, from: List<String>, to: List<String>, sourceEtag: String, targetEtag: String)
  fun ensureFolder(credential: StoredAccountCredential, path: List<String>)
  fun relocate(credential: StoredAccountCredential, from: List<String>, to: List<String>, etag: String, copy: Boolean)
}

class DestinationChangeManager(
  private val database: EngineRoomDatabase,
  private val repository: AccountRepository,
  private val network: DestinationNetworkClient = NextcloudDestinationClient(),
) {
  private val dao = database.engineDao()

  fun root(fallback: List<String> = listOf("Phone Uploads")): List<String> {
    dao.setting(BACKUP_ROOT)?.let { value -> return JSONArray(value).let { a -> List(a.length(), a::getString) } }
    return EngineOperations.lock.withLock {
      dao.setting(BACKUP_ROOT)?.let { value -> JSONArray(value).let { a -> List(a.length(), a::getString) } }
        ?: DavPath.validate(fallback).also { dao.putSetting(EngineSettingEntity(BACKUP_ROOT, JSONArray(it).toString())) }
    }
  }

  fun pending(): DestinationOperation? = dao.setting(DESTINATION_CHANGE)?.let { value ->
    DestinationOperation.read(value).also { operation ->
      val files = operation.files.associateBy { it.revisionId }
      for (progress in dao.settingsWithPrefix("destination-file:${operation.id}:")) {
        val saved = JSONObject(progress.value)
        files[saved.getString("revisionId")]?.apply {
          if (saved.has("to")) to = saved.path("to")
          duplicateEtag = saved.nullableString("duplicateEtag")
          etag = saved.nullableString("etag"); attempted = saved.getBoolean("attempted")
          done = saved.getBoolean("done"); present = saved.getBoolean("present")
        }
      }
    }
  }

  private fun routes(request: DestinationChangeRequest): List<DestinationRoute> {
    val target = DavPath.validate(request.pathSegments)
    val oldRoot = root()
    return if (request.rootChange) dao.allSources().map { source ->
      DestinationRoute(source.id, source.name, source.remotePathSegments,
        destinationUnderNewRoot(source.remotePathSegments, oldRoot, target))
    }.filter { it.from != it.to } else {
      if (!target.under(oldRoot)) throw EngineInvalidInputException("Choose a destination inside /${oldRoot.joinToString("/")}.")
      val source = request.sourceId?.let(dao::source) ?: throw EngineInvalidInputException("The backup folder no longer exists.")
      listOf(DestinationRoute(source.id, source.name, source.remotePathSegments, target)).filter { it.from != it.to }
    }
  }

  fun preview(request: DestinationChangeRequest): Map<String, Any?> {
    EngineOperations.requireAvailable(dao)
    return operation(request, "move").summary()
  }

  private fun operation(request: DestinationChangeRequest, mode: String): DestinationOperation {
    val routes = routes(request)
    val files = routes.flatMap { route ->
      val source = checkNotNull(dao.source(route.sourceId))
      val sourceJobs = dao.sourceJobs(source.id)
      val jobs = sourceJobs.associateBy { it.revisionId }
      fun file(revision: LocalRevisionEntity, job: UploadJobEntity?, available: Boolean): DestinationFile {
        val from = job?.let { it.remotePathSegments + it.remoteFileName }
          ?: (route.from + revision.relativePath.split('/'))
        val relative = if (from.under(route.from)) from.drop(route.from.size)
          else revision.relativePath.split('/').dropLast(1) + (job?.remoteFileName ?: revision.relativePath.substringAfterLast('/'))
        return DestinationFile(source.id, revision.id, job?.id, from, route.to + relative, localAvailable = available)
      }
      val current = dao.currentRevisions(source.id, source.lastScanAt ?: -1).map { file(it, jobs[it.id], true) }
      val knownPaths = current.map { it.from }.toMutableSet()
      val archived = sourceJobs.filter { it.state == JobState.COMPLETED }.mapNotNull { job ->
        if (!knownPaths.add(job.remotePathSegments + job.remoteFileName)) return@mapNotNull null
        dao.revision(job.revisionId)?.let { file(it, job, false) }
      }
      current + archived
    }
    return DestinationOperation(UUID.randomUUID().toString(), routes, files,
      request.pathSegments.takeIf { request.rootChange }, mode)
  }

  fun begin(request: DestinationChangeRequest, mode: String): Map<String, Any?> {
    if (mode !in setOf("move", "copy")) throw EngineInvalidInputException("Choose move or upload new copies.")
    EngineOperations.destinationRequested = true
    try {
      return EngineOperations.lock.withLock {
        if (pending() != null) throw EngineInvalidInputException("A destination change is already in progress.")
        operation(request, mode).also(::save).summary()
      }
    } finally { EngineOperations.destinationRequested = false }
  }

  fun acknowledge(id: String) = EngineOperations.lock.withLock {
    val op = pending() ?: return@withLock
    if (op.id != id || op.state != "completed") throw EngineInvalidInputException("The destination change has not finished.")
    database.runInTransaction {
      dao.deleteSetting(DESTINATION_CHANGE)
      dao.deleteSettingsWithPrefix("destination-file:${op.id}:")
    }
  }

  private fun saveFile(op: DestinationOperation, file: DestinationFile) {
    val progress = JSONObject().put("revisionId", file.revisionId).put("etag", file.etag).put("to", JSONArray(file.to))
      .put("duplicateEtag", file.duplicateEtag).put("originalTo", JSONArray(file.originalTo))
      .put("attempted", file.attempted).put("done", file.done).put("present", file.present)
    dao.putSetting(EngineSettingEntity("destination-file:${op.id}:${file.revisionId}", progress.toString()))
  }

  private fun save(op: DestinationOperation) = dao.putSetting(EngineSettingEntity(DESTINATION_CHANGE, op.json().toString()))

  /** MOVE is conditional and journaled per file. Retry resolves a lost response using the recorded ETag. */
  fun run(id: String, uploadCopies: Boolean = false): Map<String, Any?> = EngineOperations.lock.withLock {
    val op = pending() ?: throw EngineInvalidInputException("The destination change no longer exists.")
    if (op.id != id) throw EngineInvalidInputException("A different destination change is in progress.")
    if (op.state == "completed") return@withLock op.summary()
    if (uploadCopies) op.mode = "copy"
    op.state = "running"; op.message = null; op.errorFile = null; op.errorSourceId = null
    save(op)
    var current: DestinationFile? = null
    try {
      val credential = repository.credential() ?: throw AccountNotConfiguredException()
      network.reset()
      val movingIds = op.routes.map { it.sourceId }.toSet()
      val otherSources = dao.allSources().filter { it.id !in movingIds }
      val ensured = mutableSetOf<List<String>>()
      for (file in op.files) {
        current = file
        if (file.done) continue
        if (op.mode == "copy") {
          // Switching modes after a lost response must retain already-moved remote archives too.
          if ((file.attempted || file.duplicateEtag != null) && network.etag(credential, file.from) == null) {
            file.present = network.etag(credential, file.to) == (file.duplicateEtag ?: file.etag)
          }
          file.done = true; saveFile(op, file); continue
        }
        val same = op.files.firstOrNull { it !== file && it.from == file.from && it.originalTo == file.originalTo && it.done }
        if (same != null) {
          file.to = same.to; file.present = same.present; file.done = true; saveFile(op, file); continue
        }
        if (file.from == file.to) { file.present = true; file.done = true; saveFile(op, file); continue }
        val sourceEtag = network.etag(credential, file.from)
        if (sourceEtag == null) {
          // A missing source is only a recovered MOVE when its recorded ETag agrees at the destination.
          file.present = file.etag != null && network.etag(credential, file.to) == (file.duplicateEtag ?: file.etag)
          if (file.etag != null && !file.present) throw EngineInvalidInputException("The file changed or disappeared during the move. Check both destinations before retrying.")
          file.done = true; saveFile(op, file); continue
        }
        if (file.etag != null && file.etag != sourceEtag) throw EngineInvalidInputException("The remote file changed during the move. Leave it in place and upload a new copy, or restore the original before retrying.")
        file.etag = sourceEtag
        saveFile(op, file) // Persist before the request can move anything on the server.
        // Shared originals stay available to other backups and later branches of this operation.
        val copy = otherSources.any { file.from.under(it.remotePathSegments) } ||
          op.files.any { it !== file && !it.done && it.from == file.from && it.originalTo != file.originalTo }
        val sourceHash by lazy { network.hash(credential, file.from, sourceEtag) }
        var races = 0
        var suffix = 1
        while (true) {
          val targetEtag = network.etag(credential, file.to)
          if (file.attempted && copy && targetEtag == file.etag) break
          if (targetEtag != null) {
            val identical = op.files.size <= 20 && (
              file.duplicateEtag == targetEtag ||
                sourceHash?.let { hash ->
                  hash == network.hash(credential, file.to, targetEtag)
                } == true)
            if (identical) {
              file.duplicateEtag = targetEtag
              saveFile(op, file)
              if (!copy) network.deleteDuplicate(credential, file.from, file.to, sourceEtag, targetEtag)
              break
            }
            file.to = numberedDestination(file.originalTo, suffix++)
            file.attempted = false; file.duplicateEtag = null
            saveFile(op, file)
            continue
          }
          if (ensured.add(file.to.dropLast(1))) network.ensureFolder(credential, file.to.dropLast(1))
          file.duplicateEtag = null; file.attempted = true; saveFile(op, file)
          try {
            network.relocate(credential, file.from, file.to, sourceEtag, copy)
            break
          } catch (error: DestinationPreconditionException) {
            // A destination can appear after the listing. Refresh before choosing another name.
            network.reset()
            if (++races >= 20 || network.etag(credential, file.from) != sourceEtag) throw error
          }
        }
        file.present = true; file.done = true; saveFile(op, file)
      }
      current = null
      for (route in op.routes) network.ensureFolder(credential, route.to)
      op.root?.let { network.ensureFolder(credential, it) }
      database.runInTransaction {
        for (route in op.routes) {
          val source = dao.source(route.sourceId) ?: throw EngineSourceNotFoundException(route.sourceId)
          check(source.remotePathSegments == route.from) { "The backup destination changed while files were moving." }
          val files = op.files.filter { it.sourceId == source.id }.associateBy { it.revisionId }
          val byOriginalPath = files.values.associateBy { it.from }
          val jobs = dao.sourceJobs(source.id)
          for (job in jobs) {
            val file = files[job.revisionId] ?: byOriginalPath[job.remotePathSegments + job.remoteFileName]
            if (job.state == JobState.COMPLETED && (file == null || !file.localAvailable && !file.present)) continue
            val relative = if (job.remotePathSegments.under(route.from)) job.remotePathSegments.drop(route.from.size)
              else dao.revision(job.revisionId)?.relativePath?.split('/')?.dropLast(1).orEmpty()
            val path = file?.to?.dropLast(1) ?: (route.to + relative)
            val requeue = file != null && file.localAvailable && !file.present || job.state != JobState.COMPLETED
            dao.deleteChunkCheckpoint(job.id)
            dao.updateJob(job.copy(remotePathSegments = path, remoteFileName = file?.to?.last() ?: job.remoteFileName,
              state = if (requeue) JobState.QUEUED else job.state,
              completedAt = if (requeue) null else job.completedAt, startedAt = null, retryAt = null,
              attemptCount = 0, claimToken = null, blockerCode = null, lastErrorCode = null))
          }
          for (file in files.values.filter { it.jobId == null }) {
            val revision = checkNotNull(dao.revision(file.revisionId))
            dao.insertJob(UploadJobEntity(UUID.randomUUID().toString(), source.accountId, source.id, revision.id,
              file.to.dropLast(1), file.to.last(), if (file.present) JobState.COMPLETED else JobState.QUEUED,
              System.currentTimeMillis(), null, if (file.present) System.currentTimeMillis() else null,
              null, 0, null, null, null))
          }
          dao.upsertSource(source.copy(remotePathSegments = route.to,
            blockerCode = source.blockerCode.takeUnless { it in setOf("remote_missing", "remote_permission", "invalid_path") }))
        }
        op.root?.let { dao.putSetting(EngineSettingEntity(BACKUP_ROOT, JSONArray(it).toString())) }
        op.state = "completed"; save(op)
      }
    } catch (error: Exception) {
      op.state = "failed"
      op.message = error.message ?: "The destination change could not finish. Retry or leave the remaining files and upload copies."
      op.errorSourceId = current?.sourceId
      op.errorFile = current?.from?.joinToString("/", prefix = "/")
      save(op)
    }
    op.summary()
  }
}

/** Keep the extension so renamed photos and videos still open normally. */
internal fun numberedDestination(path: List<String>, number: Int): List<String> {
  val name = path.last()
  val dot = name.lastIndexOf('.').takeIf { it > 0 } ?: name.length
  return path.dropLast(1) + "${name.take(dot)}_${number}${name.drop(dot)}"
}

class DestinationPreconditionException : Exception("The file changed on Nextcloud. Please retry.")
