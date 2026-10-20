package ninja.domi.cloudhoist.engine

/** Uses the still-available credential to remove known remote temporary upload state. */
class ChunkSessionCleanup(
  private val sessions: () -> List<ChunkSessionRecord>,
  private val credential: () -> StoredAccountCredential?,
  private val transport: ChunkTransport,
) {
  constructor(
    dao: EngineDao,
    accountRepository: AccountRepository,
    transport: ChunkTransport,
  ) : this(dao::chunkSessions, accountRepository::credential, transport)

  fun run() {
    val accountCredential = credential() ?: return
    sessions().forEach { session ->
      runCatching {
        transport.abort(
          accountCredential,
          session.uploadId,
          DavUploadRequest(
            localUri = session.localUri,
            remotePathSegments = session.remotePathSegments,
            fileName = session.remoteFileName,
            byteCount = session.byteCount,
            mimeType = session.mimeType,
            modifiedAtEpochSeconds = session.modifiedAt,
            createdAtEpochSeconds = session.createdAt,
          ),
        )
      }
    }
  }
}
