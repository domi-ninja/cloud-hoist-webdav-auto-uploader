package ninja.domi.webdavautoupload.engine

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class ManualAccountInputRecord : Record {
  @Field
  val serverUrl: String = ""

  @Field
  val username: String = ""

  @Field
  val appPassword: String = ""
}

data class LoginFlowRequest(
  val loginUrl: String,
  val pollEndpoint: String,
  val token: String,
)

data class LoginFlowCredentials(
  val serverUrl: String,
  val loginName: String,
  val appPassword: String,
)

data class LoginFlowStart(
  val attemptId: String,
  val loginUrl: String,
  val expiresAt: String,
) {
  fun toMap() = mapOf(
    "attemptId" to attemptId,
    "loginUrl" to loginUrl,
    "expiresAt" to expiresAt,
  )
}

sealed interface LoginFlowPoll {
  fun toMap(): Map<String, Any?>

  data object Pending : LoginFlowPoll {
    override fun toMap() = mapOf("status" to "pending")
  }

  data class Connected(val account: StoredAccount) : LoginFlowPoll {
    override fun toMap() = mapOf(
      "status" to "connected",
      "account" to account.toMap(),
    )
  }
}

fun AccountCapabilities.toMap() = mapOf(
  "serverVersion" to serverVersion,
  "chunkingSupported" to chunkingSupported,
  "maxChunkSize" to maxChunkSize,
)

fun StoredAccount.toMap() = mapOf(
  "id" to id,
  "serverUrl" to serverUrl,
  "username" to loginName,
  "davUserId" to davUserId,
  "displayName" to displayName,
  "checkedAt" to checkedAt,
  "capabilities" to capabilities.toMap(),
)
