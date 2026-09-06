package ninja.domi.webdavautoupload.engine

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import java.net.InetAddress
import java.net.URI
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import okhttp3.Dns
import okhttp3.OkHttpClient

data class DebugUploadAcceptanceResult(
  val smallName: String,
  val smallSha256: String,
  val largeName: String,
  val largeSha256: String,
  val completedJobs: Int,
  val directUploads: Int,
  val chunkedUploads: Int,
  val chunkingExpected: Boolean,
)

class DebugUploadAcceptanceException(
  val acceptanceCode: String,
  cause: Throwable? = null,
) : Exception(acceptanceCode, cause)

/** Runs live upload checks through production discovery, queue, and DAV classes. */
class DebugUploadAcceptance(
  private val context: Context,
  serverUrl: String,
  serverAddress: String,
) {
  private val dao = EngineRoomDatabase.open(context).engineDao()
  private val repository = AndroidAccountRepository(context, dao)
  private var lastHttpResult = "NO_RESPONSE"
  private val httpClient = OkHttpClient.Builder()
    .dns(acceptanceDns(serverUrl, serverAddress))
    .addInterceptor { chain ->
      chain.proceed(chain.request()).also { response ->
        val request = chain.request()
        val bodyHint = response.peekBody(4_096).string().lowercase().let { body ->
          when {
            "permission denied to put into this file" in body -> "FUTURE_PUT"
            "permission denied to rename" in body -> "RENAME_PERMISSION"
            "permission denied to create file" in body -> "CREATE_PERMISSION"
            "could not create" in body -> "CREATE_FAILED"
            "no read permissions" in body -> "READ_PERMISSION"
            "chunks on server do not sum up" in body -> "CHUNK_LENGTH"
            "destination" in body && "directory" in body -> "DESTINATION_DIRECTORY"
            "mtime" in body || "modification time" in body -> "MTIME"
            "ctime" in body || "creation time" in body -> "CTIME"
            "filesize" in body || "content-length" in body -> "LENGTH"
            "mime" in body || "media type" in body -> "MIME"
            "locked" in body -> "LOCKED"
            "forbidden" in body || "permission" in body -> "PERMISSION"
            else -> "OTHER"
          }
        }
        lastHttpResult = buildString {
          append(request.method)
          append('_')
          append(response.code)
          append("_L")
          append(request.body?.contentLength() ?: 0)
          append("_M")
          append(if (request.header("X-OC-Mtime") == null) 0 else 1)
          append("_C")
          append(if (request.header("X-OC-CTime") == null) 0 else 1)
          append('_')
          append(bodyHint)
        }
      }
    }
    .build()
  private val discovery = SourceDiscoveryManager(
    accountRepository = repository,
    recorder = SourceRevisionRecorder(dao),
    mediaDiscovery = AndroidMediaStoreDiscovery(context),
    documentTreeDiscovery = DocumentTreeDiscovery(AndroidDocumentTreeGateway(context)),
  )

  fun prepare(runFolder: String) {
    validateRunFolder(runFolder)
    RemoteFolderManager(repository, NextcloudDavClient(httpClient)).create(emptyList(), runFolder)
    discovery.commit(
      SourceCommit(
        name = SOURCE_NAME,
        selection = SourceSelection(SourceType.CAMERA),
        remotePathSegments = listOf(runFolder),
        collisionPolicy = CollisionPolicy.REPLACE,
      ),
    )
  }

  fun seedAndUpload(runFolder: String): DebugUploadAcceptanceResult {
    validateRunFolder(runFolder)
    val source = dao.allSources().singleOrNull { source ->
      source.name == SOURCE_NAME && source.remotePathSegments == listOf(runFolder)
    } ?: error("The acceptance source is missing.")
    val small = acceptanceStage("ERR_ACCEPTANCE_SMALL_MEDIA") {
      createBitmap("$runFolder-small.bmp", SMALL_WIDTH, SMALL_HEIGHT, 17)
    }
    val large = acceptanceStage("ERR_ACCEPTANCE_LARGE_MEDIA") {
      createBitmap("$runFolder-large.bmp", LARGE_WIDTH, LARGE_HEIGHT, 83)
    }

    val scan = acceptanceStage("ERR_ACCEPTANCE_SCAN") { discovery.scan(source.id) }
    if (scan.blocker != null || scan.jobsAdded != 2) {
      throw DebugUploadAcceptanceException(
        "ERR_ACCEPTANCE_SCAN_${scan.blocker?.name ?: "JOB_COUNT"}",
      )
    }

    val credential = requireNotNull(repository.credential())
    val contentSource = AndroidLocalContentSource(context.contentResolver)
    var directUploads = 0
    var chunkedUploads = 0
    var transferException: String? = null
    var transferStage = "NONE"
    val directClient = NextcloudUploadClient(contentSource, httpClient)
    val chunkedClient = NextcloudChunkUploadClient(
      checkpoints = RoomChunkCheckpointStore(dao),
      transport = NextcloudChunkTransport(contentSource, httpClient),
    )
    val runner = QueueDrainRunner(
      dao = dao,
      accountRepository = repository,
      davClient = DavClient { account, request ->
        transferStage = "DIRECT"
        try {
          directClient.upload(account, request).also {
            directUploads += 1
          }
        } catch (error: Exception) {
          transferException = error::class.simpleName
          throw error
        }
      },
      chunkedDavClient = ChunkedDavClient { account, jobId, request ->
        transferStage = "CHUNK"
        try {
          chunkedClient.upload(account, jobId, request).also { result ->
            if (result != null) chunkedUploads += 1
          }
        } catch (error: Exception) {
          transferException = error::class.simpleName
          throw error
        }
      },
      mimeType = { uri -> context.contentResolver.getType(Uri.parse(uri)) },
      isPaused = { false },
      canStartNextFile = { true },
      maxJobs = 2,
    )
    val drain = runner.run()
    val jobs = dao.recentJobViews().filter { it.sourceId == source.id }
    val chunkingExpected = chunkPlan(
      large.byteCount,
      credential.account.capabilities.chunkingSupported,
      credential.account.capabilities.maxChunkSize,
    ) != null

    if (drain.completedJobs != 2 || jobs.size != 2 || jobs.any { it.state != JobState.COMPLETED }) {
      val reason = transferException?.let { "$transferStage-$it-$lastHttpResult" }
        ?: jobs.firstNotNullOfOrNull { it.lastErrorCode }
        ?: jobs.firstOrNull { it.state != JobState.COMPLETED }?.state
        ?: "JOB_COUNT"
      throw DebugUploadAcceptanceException("ERR_ACCEPTANCE_QUEUE_${reason.uppercase()}")
    }
    check(directUploads + chunkedUploads == 2) {
      "The acceptance queue did not record both upload paths."
    }
    check(chunkedUploads == if (chunkingExpected) 1 else 0) {
      "The large fixture used the wrong upload path."
    }

    return DebugUploadAcceptanceResult(
      smallName = small.name,
      smallSha256 = small.sha256,
      largeName = large.name,
      largeSha256 = large.sha256,
      completedJobs = drain.completedJobs,
      directUploads = directUploads,
      chunkedUploads = chunkedUploads,
      chunkingExpected = chunkingExpected,
    )
  }

  fun cleanupMedia(runFolder: String) {
    validateRunFolder(runFolder)
    // The harness deletes this destination next. Do not leave an enabled watcher behind.
    dao.allSources().filter { source ->
      source.name == SOURCE_NAME && source.remotePathSegments == listOf(runFolder)
    }.forEach { source -> dao.removeSource(source.id) }
    val names = arrayOf("$runFolder-small.bmp", "$runFolder-large.bmp")
    context.contentResolver.query(
      MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
      arrayOf(MediaStore.Images.Media._ID),
      "${MediaStore.Images.Media.DISPLAY_NAME} IN (?, ?)",
      names,
      null,
    )?.use { cursor ->
      val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
      while (cursor.moveToNext()) {
        context.contentResolver.delete(
          ContentUris.withAppendedId(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            cursor.getLong(idColumn),
          ),
          null,
          null,
        )
      }
    }
  }

  private fun createBitmap(name: String, width: Int, height: Int, seed: Int): Fixture {
    val rowBytes = ((width * 3 + 3) / 4) * 4
    val byteCount = 54L + rowBytes.toLong() * height
    val values = ContentValues().apply {
      put(MediaStore.Images.Media.DISPLAY_NAME, name)
      put(MediaStore.Images.Media.MIME_TYPE, "image/bmp")
      put(MediaStore.Images.Media.RELATIVE_PATH, "DCIM/Camera")
      put(MediaStore.Images.Media.IS_PENDING, 1)
    }
    val uri = requireNotNull(
      context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values),
    )
    return try {
      val digest = MessageDigest.getInstance("SHA-256")
      context.contentResolver.openOutputStream(uri, "w")!!.use { output ->
        val header = bitmapHeader(width, height, byteCount.toInt())
        output.write(header)
        digest.update(header)
        val row = ByteArray(rowBytes)
        repeat(height) { y ->
          repeat(width) { x ->
            val offset = x * 3
            row[offset] = ((x + seed) and 0xff).toByte()
            row[offset + 1] = ((y + seed * 3) and 0xff).toByte()
            row[offset + 2] = ((x + y + seed * 7) and 0xff).toByte()
          }
          output.write(row)
          digest.update(row)
        }
      }
      context.contentResolver.update(
        uri,
        ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) },
        null,
        null,
      )
      Fixture(name, byteCount, digest.digest().toHex())
    } catch (error: Exception) {
      context.contentResolver.delete(uri, null, null)
      throw error
    }
  }

  private fun bitmapHeader(width: Int, height: Int, byteCount: Int): ByteArray =
    ByteBuffer.allocate(54).order(ByteOrder.LITTLE_ENDIAN).apply {
      put('B'.code.toByte())
      put('M'.code.toByte())
      putInt(byteCount)
      putInt(0)
      putInt(54)
      putInt(40)
      putInt(width)
      putInt(height)
      putShort(1.toShort())
      putShort(24.toShort())
      putInt(0)
      putInt(byteCount - 54)
      putInt(2_835)
      putInt(2_835)
      putInt(0)
      putInt(0)
    }.array()

  private fun validateRunFolder(runFolder: String) {
    require(RUN_FOLDER.matches(runFolder)) { "The acceptance run folder is invalid." }
  }

  private inline fun <T> acceptanceStage(code: String, block: () -> T): T = try {
    block()
  } catch (error: DebugUploadAcceptanceException) {
    throw error
  } catch (error: Exception) {
    throw DebugUploadAcceptanceException(code, error)
  }

  private fun ByteArray.toHex() = joinToString("") { byte -> "%02x".format(byte) }

  private data class Fixture(
    val name: String,
    val byteCount: Long,
    val sha256: String,
  )

  private companion object {
    val RUN_FOLDER = Regex("webdav-auto-upload-acceptance-[a-z0-9-]{8,80}")
    const val SOURCE_NAME = "Acceptance camera"
    const val SMALL_WIDTH = 64
    const val SMALL_HEIGHT = 64
    const val LARGE_WIDTH = 4_096
    const val LARGE_HEIGHT = 2_048
  }
}

fun acceptanceDns(serverUrl: String, serverAddress: String) = object : Dns {
  override fun lookup(hostname: String): List<InetAddress> =
    if (hostname.equals(URI(serverUrl).host, ignoreCase = true)) {
      listOf(InetAddress.getByName(serverAddress))
    } else {
      Dns.SYSTEM.lookup(hostname)
    }
}
