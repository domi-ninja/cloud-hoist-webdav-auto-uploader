package ninja.domi.cloudhoist.engine

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.interfaces.permissions.Permissions
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.PermissionsStatus

data class NotificationPermissionState(
  val granted: Boolean,
  val canAskAgain: Boolean,
) {
  fun toMap(): Map<String, Any> = mapOf(
    "granted" to granted,
    "canAskAgain" to canAskAgain,
  )
}

/** Android 12 and older grant notification access as part of installing the app. */
class NotificationPermissionController(
  private val context: Context,
  private val permissions: Permissions,
) {
  fun get(onResult: (NotificationPermissionState) -> Unit) {
    if (!requiresRuntimePermission()) {
      onResult(NotificationPermissionState(granted = true, canAskAgain = false))
      return
    }
    permissions.getPermissions(
      { responses -> onResult(state(responses)) },
      Manifest.permission.POST_NOTIFICATIONS,
    )
  }

  fun request(onResult: (NotificationPermissionState) -> Unit) {
    if (!requiresRuntimePermission()) {
      onResult(NotificationPermissionState(granted = true, canAskAgain = false))
      return
    }
    permissions.askForPermissions(
      { responses -> onResult(state(responses)) },
      Manifest.permission.POST_NOTIFICATIONS,
    )
  }

  private fun state(responses: Map<String, PermissionsResponse>): NotificationPermissionState {
    val granted = context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED
    val response = responses[Manifest.permission.POST_NOTIFICATIONS]
    return NotificationPermissionState(
      granted = granted,
      canAskAgain = !granted &&
        response?.status != PermissionsStatus.GRANTED &&
        response?.canAskAgain == true,
    )
  }

  private fun requiresRuntimePermission() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
}
