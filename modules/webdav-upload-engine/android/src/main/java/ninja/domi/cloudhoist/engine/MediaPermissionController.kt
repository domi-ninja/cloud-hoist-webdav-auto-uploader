package ninja.domi.cloudhoist.engine

import android.Manifest
import android.content.Context
import android.os.Build
import expo.modules.interfaces.permissions.Permissions
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.PermissionsStatus

data class MediaPermissionState(
  val access: MediaPermissionAccess,
  val canAskAgain: Boolean,
) {
  fun toMap(): Map<String, Any> = mapOf(
    "access" to access.name.lowercase(),
    "canAskAgain" to canAskAgain,
  )
}

class MediaPermissionController(
  private val context: Context,
  private val permissions: Permissions,
) {
  fun get(onResult: (MediaPermissionState) -> Unit) {
    permissions.getPermissions(
      { responses -> onResult(state(responses)) },
      *permissionsForDevice(),
    )
  }

  fun request(onResult: (MediaPermissionState) -> Unit) {
    permissions.askForPermissions(
      { responses -> onResult(state(responses)) },
      *permissionsForDevice(),
    )
  }

  private fun state(
    responses: Map<String, PermissionsResponse>,
  ): MediaPermissionState {
    val access = currentMediaPermissionAccess(context)
    val canAskAgain = access != MediaPermissionAccess.DENIED || responses.values
      .filter { it.status != PermissionsStatus.GRANTED }
      .all(PermissionsResponse::canAskAgain)
    return MediaPermissionState(access, canAskAgain)
  }

  private fun permissionsForDevice(): Array<String> = when {
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> arrayOf(
      Manifest.permission.READ_MEDIA_IMAGES,
      Manifest.permission.READ_MEDIA_VIDEO,
      Manifest.permission.READ_MEDIA_AUDIO,
      Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED,
    )
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> arrayOf(
      Manifest.permission.READ_MEDIA_IMAGES,
      Manifest.permission.READ_MEDIA_VIDEO,
      Manifest.permission.READ_MEDIA_AUDIO,
    )
    else -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
  }
}
