package ninja.domi.webdavautoupload.engine

import android.content.Context

/** Persists the grant-release intent across the Room deletion boundary. */
class SourceRemovalCleanup(
  context: Context,
  private val dao: EngineDao,
  private val releaseReadPermission: (String) -> Unit,
) {
  private val state = context.applicationContext.getSharedPreferences(
    PREFERENCES_NAME,
    Context.MODE_PRIVATE,
  )

  fun remove(sourceId: String, deleteSource: () -> Unit) {
    val source = dao.source(sourceId) ?: throw EngineSourceNotFoundException(sourceId)
    val ownsLastGrant = source.kind == "saf" &&
      dao.allSources().count { it.localUri == source.localUri } == 1
    if (ownsLastGrant) prepare(source)
    deleteSource()
    finishInterruptedRemoval()
  }

  internal fun prepare(source: SourceEntity) {
    check(
      state.edit()
        .putString(KEY_SOURCE_ID, source.id)
        .putString(KEY_SOURCE_URI, source.localUri)
        .commit(),
    ) { "Could not persist source-removal state." }
  }

  fun finishInterruptedRemoval() {
    val sourceId = state.getString(KEY_SOURCE_ID, null)
    val sourceUri = state.getString(KEY_SOURCE_URI, null)
    if (sourceId == null || sourceUri == null) {
      if (state.all.isNotEmpty()) state.edit().clear().commit()
      return
    }
    if (dao.source(sourceId) == null && dao.allSources().none { it.localUri == sourceUri }) {
      runCatching { releaseReadPermission(sourceUri) }
    }
    check(state.edit().clear().commit()) { "Could not clear source-removal state." }
  }

  private companion object {
    const val PREFERENCES_NAME = "webdav_source_removal_cleanup"
    const val KEY_SOURCE_ID = "sourceId"
    const val KEY_SOURCE_URI = "sourceUri"
  }
}
