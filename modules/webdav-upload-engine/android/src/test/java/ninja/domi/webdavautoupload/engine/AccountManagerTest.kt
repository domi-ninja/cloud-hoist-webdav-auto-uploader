package ninja.domi.webdavautoupload.engine

import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountManagerTest {
  private val now = Instant.parse("2026-09-04T12:00:00Z")

  @Test
  fun manualLoginStoresResolvedDavIdentityAndCapabilities() {
    val repository = FakeAccountRepository()
    var invalidated = false
    val manager = AccountManager(
      repository = repository,
      networkClient = FakeAccountNetworkClient(),
      clock = Clock.fixed(now, ZoneOffset.UTC),
      onAccountChanged = { invalidated = true },
    )

    val account = manager.connectManual(
      "https://Cloud.Example.Test/nextcloud/",
      " email-login@example.test ",
      "app-password",
    )

    assertEquals("https://cloud.example.test/nextcloud", account.serverUrl)
    assertEquals("email-login@example.test", account.loginName)
    assertEquals("resolved-dav-id", account.davUserId)
    assertEquals("app-password", repository.stored?.appPassword)
    assertTrue(account.capabilities.chunkingSupported)
    assertTrue(invalidated)
  }

  @Test
  fun manualReplacementKeepsTheAccountIdentity() {
    val repository = FakeAccountRepository()
    val manager = AccountManager(
      repository = repository,
      networkClient = FakeAccountNetworkClient(),
      clock = Clock.fixed(now, ZoneOffset.UTC),
      onAccountChanged = {},
    )
    val original = manager.connectManual("https://old.example.test", "old", "old-secret")

    val replacement = manager.replaceManual(
      "https://new.example.test",
      "new",
      "new-secret",
    )

    assertEquals(original.id, replacement.id)
    assertEquals("https://new.example.test", replacement.serverUrl)
    assertEquals("new", repository.stored?.account?.loginName)
    assertEquals("new-secret", repository.stored?.appPassword)
  }

  @Test
  fun browserLoginUsesAuthoritativeServerAndNeverExposesSecret() {
    val repository = FakeAccountRepository()
    val network = FakeAccountNetworkClient().apply {
      polledCredentials = LoginFlowCredentials(
        "https://authoritative.example.test/cloud/",
        "browser-login",
        "browser-app-password",
      )
    }
    val manager = AccountManager(
      repository,
      network,
      Clock.fixed(now, ZoneOffset.UTC),
    ) {}

    val started = manager.startLoginFlow("https://entered.example.test")
    val result = manager.pollLoginFlow(started.attemptId)

    assertTrue(result is LoginFlowPoll.Connected)
    val publicResult = result.toMap().toString()
    assertFalse(publicResult.contains("browser-app-password"))
    assertEquals(
      "https://authoritative.example.test/cloud",
      repository.stored?.account?.serverUrl,
    )
  }

  @Test
  fun cancelledAndExpiredLoginsStoreNothing() {
    val repository = FakeAccountRepository()
    val clock = MutableClock(now)
    val manager = AccountManager(repository, FakeAccountNetworkClient(), clock) {}

    val cancelled = manager.startLoginFlow("https://cloud.example.test")
    manager.cancelLoginFlow(cancelled.attemptId)
    assertThrows(AccountLoginCancelledException::class.java) {
      manager.pollLoginFlow(cancelled.attemptId)
    }

    val expired = manager.startLoginFlow("https://cloud.example.test")
    clock.current = Instant.parse(expired.expiresAt)
    assertThrows(AccountLoginExpiredException::class.java) {
      manager.pollLoginFlow(expired.attemptId)
    }
    assertNull(repository.stored)
  }

  @Test
  fun verificationReloadsTheStoredCredentialForHeadlessUse() {
    val repository = FakeAccountRepository()
    val network = FakeAccountNetworkClient()
    val manager = AccountManager(
      repository,
      network,
      Clock.fixed(now, ZoneOffset.UTC),
    ) {}
    manager.connectManual("https://cloud.example.test", "login", "secret")

    network.loadedPassword = null
    manager.verifyStoredAccount()

    assertEquals("secret", network.loadedPassword)
  }

  private class FakeAccountRepository : AccountRepository {
    var stored: StoredAccountCredential? = null

    override fun currentAccount() = stored?.account
    override fun credential() = stored
    override fun save(credential: StoredAccountCredential) {
      stored = credential
    }
    override fun clear() {
      stored = null
    }
  }

  private class FakeAccountNetworkClient : AccountNetworkClient {
    var polledCredentials: LoginFlowCredentials? = null
    var loadedPassword: String? = null

    override fun startLoginFlow(serverUrl: String) = LoginFlowRequest(
      loginUrl = "$serverUrl/login/v2/flow/opaque",
      pollEndpoint = "$serverUrl/login/v2/poll",
      token = "opaque-token",
    )

    override fun pollLoginFlow(endpoint: String, token: String) = polledCredentials

    override fun resolveUser(
      serverUrl: String,
      loginName: String,
      appPassword: String,
    ): NextcloudUser {
      loadedPassword = appPassword
      return NextcloudUser("resolved-dav-id", "Domi")
    }

    override fun capabilities(
      serverUrl: String,
      loginName: String,
      appPassword: String,
    ) = AccountCapabilities("34.0.0", chunkingSupported = true, maxChunkSize = 10485760)
  }

  private class MutableClock(var current: Instant) : Clock() {
    override fun instant(): Instant = current
    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun withZone(zone: ZoneId): Clock = this
  }
}
