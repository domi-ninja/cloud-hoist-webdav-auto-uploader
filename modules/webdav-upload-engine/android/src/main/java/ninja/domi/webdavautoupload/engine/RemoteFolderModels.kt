package ninja.domi.webdavautoupload.engine

data class RemoteFolder(
  val name: String,
  val pathSegments: List<String>,
)

fun RemoteFolder.toMap(): Map<String, Any> = mapOf(
  "name" to name,
  "pathSegments" to pathSegments,
)
