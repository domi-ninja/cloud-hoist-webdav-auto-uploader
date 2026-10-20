package ninja.domi.cloudhoist.engine

import org.json.JSONException
import org.json.JSONObject

data class NextcloudUser(
  val id: String,
  val displayName: String,
)

object NextcloudJsonDecoder {
  fun decodeLoginFlowStart(body: String): LoginFlowRequest = decode {
    val root = JSONObject(body)
    val poll = root.getJSONObject("poll")
    LoginFlowRequest(
      loginUrl = requiredString(root, "login"),
      pollEndpoint = requiredString(poll, "endpoint"),
      token = requiredString(poll, "token"),
    )
  }

  fun decodeLoginFlowCredentials(body: String): LoginFlowCredentials = decode {
    val root = JSONObject(body)
    LoginFlowCredentials(
      serverUrl = requiredString(root, "server"),
      loginName = requiredString(root, "loginName"),
      appPassword = requiredString(root, "appPassword"),
    )
  }

  fun decodeUser(body: String): NextcloudUser = decode {
    val data = ocsData(JSONObject(body))
    val id = requiredString(data, "id")
    NextcloudUser(
      id = id,
      displayName = data.optString("displayname").ifBlank { id },
    )
  }

  fun decodeCapabilities(body: String): AccountCapabilities = decode {
    val data = ocsData(JSONObject(body))
    val version = data.getJSONObject("version")
    val capabilities = data.getJSONObject("capabilities")
    val files = capabilities.optJSONObject("files")

    val maxChunkSize = files
      ?.optLong("max_chunk_size", -1L)
      ?.takeIf { it > 0L }

    AccountCapabilities(
      serverVersion = requiredString(version, "string"),
      chunkingSupported = files?.optBoolean("bigfilechunking", false) ?: false,
      maxChunkSize = maxChunkSize,
    )
  }

  private fun ocsData(root: JSONObject): JSONObject {
    val ocs = root.getJSONObject("ocs")
    val meta = ocs.getJSONObject("meta")
    val statusCode = meta.optInt("statuscode", 0)
    if (statusCode == 997 || statusCode == 998) {
      throw AccountInvalidCredentialsException()
    }
    if (meta.optString("status") != "ok" || statusCode !in setOf(100, 200)) {
      throw AccountUnsupportedResponseException()
    }
    return ocs.getJSONObject("data")
  }

  private fun requiredString(objectValue: JSONObject, key: String): String =
    objectValue.getString(key).takeIf(String::isNotBlank)
      ?: throw AccountUnsupportedResponseException()

  private inline fun <T> decode(block: () -> T): T = try {
    block()
  } catch (error: AccountInvalidCredentialsException) {
    throw error
  } catch (error: AccountUnsupportedResponseException) {
    throw error
  } catch (_: JSONException) {
    throw AccountUnsupportedResponseException()
  }
}
