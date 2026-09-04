package ninja.domi.webdavautoupload.engine

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID

class AccountManager(
  private val repository: AccountRepository,
  private val networkClient: AccountNetworkClient,
  private val clock: Clock = Clock.systemUTC(),
  private val onAccountChanged: () -> Unit,
) {
  private data class PendingLogin(
    val pollEndpoint: String,
    val token: String,
    val expiresAt: Instant,
  )

  private val pendingLogins = mutableMapOf<String, PendingLogin>()

  fun accountHealth(): Map<String, Any?> = repository.currentAccount()?.let { account ->
    mapOf(
      "status" to "connected",
      "id" to account.id,
      "serverUrl" to account.serverUrl,
      "username" to account.loginName,
      "davUserId" to account.davUserId,
      "displayName" to account.displayName,
      "checkedAt" to account.checkedAt,
      "capabilities" to account.capabilities.toMap(),
    )
  } ?: mapOf("status" to "not_configured")

  fun connectManual(
    serverUrl: String,
    username: String,
    appPassword: String,
  ): StoredAccount {
    ensureNoAccount()
    val loginName = username.trim()
    if (loginName.isBlank() || appPassword.isBlank()) {
      throw AccountInvalidCredentialsException()
    }

    return validateAndStore(
      serverUrl = ServerUrlNormalizer.normalize(serverUrl),
      loginName = loginName,
      appPassword = appPassword,
    )
  }

  @Synchronized
  fun startLoginFlow(serverUrl: String): LoginFlowStart {
    ensureNoAccount()
    val normalizedUrl = ServerUrlNormalizer.normalize(serverUrl)
    val request = networkClient.startLoginFlow(normalizedUrl)
    val loginUrl = ServerUrlNormalizer.normalizeEndpoint(request.loginUrl)
    val pollEndpoint = ServerUrlNormalizer.normalizeEndpoint(request.pollEndpoint)
    val attemptId = UUID.randomUUID().toString()
    val expiresAt = clock.instant().plus(LOGIN_LIFETIME)
    pendingLogins[attemptId] = PendingLogin(pollEndpoint, request.token, expiresAt)
    return LoginFlowStart(attemptId, loginUrl, expiresAt.toString())
  }

  @Synchronized
  fun pollLoginFlow(attemptId: String): LoginFlowPoll {
    ensureNoAccount()
    val pending = pendingLogins[attemptId] ?: throw AccountLoginCancelledException()
    if (!clock.instant().isBefore(pending.expiresAt)) {
      pendingLogins.remove(attemptId)
      throw AccountLoginExpiredException()
    }

    val credentials = networkClient.pollLoginFlow(pending.pollEndpoint, pending.token)
      ?: return LoginFlowPoll.Pending

    pendingLogins.remove(attemptId)
    val account = validateAndStore(
      serverUrl = ServerUrlNormalizer.normalize(credentials.serverUrl),
      loginName = credentials.loginName,
      appPassword = credentials.appPassword,
    )
    return LoginFlowPoll.Connected(account)
  }

  @Synchronized
  fun cancelLoginFlow(attemptId: String) {
    pendingLogins.remove(attemptId)
  }

  fun verifyStoredAccount(): StoredAccount {
    val credential = repository.credential() ?: throw AccountNotConfiguredException()
    val user = networkClient.resolveUser(
      credential.account.serverUrl,
      credential.account.loginName,
      credential.appPassword,
    )
    val capabilities = networkClient.capabilities(
      credential.account.serverUrl,
      credential.account.loginName,
      credential.appPassword,
    )
    val refreshed = credential.account.copy(
      davUserId = user.id,
      displayName = user.displayName,
      checkedAt = clock.instant().toString(),
      capabilities = capabilities,
    )
    repository.save(credential.copy(account = refreshed))
    onAccountChanged()
    return refreshed
  }

  private fun validateAndStore(
    serverUrl: String,
    loginName: String,
    appPassword: String,
  ): StoredAccount {
    val user = networkClient.resolveUser(serverUrl, loginName, appPassword)
    val capabilities = networkClient.capabilities(serverUrl, loginName, appPassword)
    val account = StoredAccount(
      id = UUID.randomUUID().toString(),
      serverUrl = serverUrl,
      loginName = loginName,
      davUserId = user.id,
      displayName = user.displayName,
      checkedAt = clock.instant().toString(),
      capabilities = capabilities,
    )
    repository.save(StoredAccountCredential(account, appPassword))
    onAccountChanged()
    return account
  }

  private fun ensureNoAccount() {
    if (repository.currentAccount() != null) {
      throw AccountAlreadyConfiguredException()
    }
  }

  private companion object {
    val LOGIN_LIFETIME: Duration = Duration.ofMinutes(15)
  }
}
