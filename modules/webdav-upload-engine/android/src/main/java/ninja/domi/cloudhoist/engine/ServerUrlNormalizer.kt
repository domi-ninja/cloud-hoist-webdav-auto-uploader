package ninja.domi.cloudhoist.engine

import java.net.URI
import java.net.URISyntaxException

object ServerUrlNormalizer {
  fun normalize(value: String): String {
    val uri = try {
      val trimmed = value.trim()
      val hasScheme = Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://").containsMatchIn(trimmed)
      val completed = when {
        trimmed.startsWith("//") -> "https:$trimmed"
        hasScheme -> trimmed
        else -> "https://$trimmed"
      }
      URI(completed)
    } catch (_: URISyntaxException) {
      throw AccountInvalidServerUrlException()
    }

    if (!uri.scheme.equals("https", ignoreCase = true)) {
      if (uri.scheme.equals("http", ignoreCase = true)) {
        throw AccountInsecureServerUrlException()
      }
      throw AccountInvalidServerUrlException()
    }

    if (
      uri.host.isNullOrBlank() ||
      uri.userInfo != null ||
      uri.rawQuery != null ||
      uri.rawFragment != null
    ) {
      throw AccountInvalidServerUrlException()
    }

    val normalizedPath = uri.rawPath
      .orEmpty()
      .trimEnd('/')

    return try {
      URI(
        "https",
        null,
        uri.host.lowercase(),
        uri.port,
        normalizedPath,
        null,
        null,
      ).toASCIIString()
    } catch (_: URISyntaxException) {
      throw AccountInvalidServerUrlException()
    }
  }

  /** Validates server-provided flow URLs without changing their exact paths or queries. */
  fun normalizeEndpoint(value: String): String {
    val uri = try {
      URI(value)
    } catch (_: URISyntaxException) {
      throw AccountUnsupportedResponseException()
    }
    if (
      !uri.scheme.equals("https", ignoreCase = true) ||
      uri.host.isNullOrBlank() ||
      uri.userInfo != null ||
      uri.rawFragment != null
    ) {
      throw AccountUnsupportedResponseException()
    }
    return uri.toASCIIString()
  }
}
