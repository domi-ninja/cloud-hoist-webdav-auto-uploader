package ninja.domi.webdavautoupload.engine

import android.content.Context

/** Persists cleanup intent first so process death cannot leave a half-signed-out account. */
class SignOutCleanup(
  context: Context,
  private val dao: EngineDao,
  private val accountRepository: AccountRepository,
  private val enginePreferences: EnginePreferences,
  private val cancelWork: () -> Unit,
  private val releaseReadPermission: (String) -> Unit,
  private val cleanupRemoteSessions: () -> Unit = {},
  private val clearDiagnostics: () -> Unit = {},
) {
  private val state = context.applicationContext.getSharedPreferences(
    PREFERENCES_NAME,
    Context.MODE_PRIVATE,
  )

  fun signOut() {
    prepare()
    finishInterruptedSignOut()
  }

  internal fun prepare() {
    val sourceUris = dao.allSources()
      .filter { it.kind == "saf" }
      .map { it.localUri }
      .toSet()
    check(
      state.edit()
        .putBoolean(KEY_IN_PROGRESS, true)
        .putStringSet(KEY_SOURCE_URIS, sourceUris)
        .commit(),
    ) { "Could not persist sign-out state." }
  }

  fun finishInterruptedSignOut() {
    if (!state.getBoolean(KEY_IN_PROGRESS, false)) return
    val sourceUris = state.getStringSet(KEY_SOURCE_URIS, emptySet()).orEmpty().toSet()
    cancelWork()
    cleanupRemoteSessions()
    accountRepository.clear()
    sourceUris.forEach { uri -> runCatching { releaseReadPermission(uri) } }
    enginePreferences.clear()
    clearDiagnostics()
    check(state.edit().clear().commit()) { "Could not clear sign-out state." }
  }

  private companion object {
    const val PREFERENCES_NAME = "webdav_sign_out_cleanup"
    const val KEY_IN_PROGRESS = "inProgress"
    const val KEY_SOURCE_URIS = "sourceUris"
  }
}
