package ninja.domi.webdavautoupload.engine

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LiveAccountAcceptanceTest {
  @Test
  fun connectedAccountRendersAfterProcessDeath() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val launchUrl = decodedArgument(
      InstrumentationRegistry.getArguments().getString("launchUrlB64"),
    )
    launchApp(instrumentation.context, launchUrl)
    val device = UiDevice.getInstance(instrumentation)
    dismissDeveloperMenuOnboarding(device)
    assertTrue(device.wait(Until.hasObject(By.desc("Verify stored account")), UI_TIMEOUT))
  }

  private fun decodedArgument(value: String?): String {
    require(!value.isNullOrBlank()) { "A required acceptance-test value is missing." }
    return try {
      Base64.decode(value, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        .toString(Charsets.UTF_8)
    } catch (_: IllegalArgumentException) {
      throw IllegalArgumentException("An acceptance-test value is malformed.")
    }
  }

  private fun launchApp(context: Context, launchUrl: String) {
    context.startActivity(
      Intent(Intent.ACTION_VIEW, Uri.parse(launchUrl))
        .setPackage(APP_PACKAGE)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK),
    )
  }

  private fun dismissDeveloperMenuOnboarding(device: UiDevice) {
    device.wait(Until.findObject(By.text("Continue")), DEVELOPER_MENU_TIMEOUT)?.click()
    device.wait(Until.findObject(By.desc("Close")), DEVELOPER_MENU_TIMEOUT)?.click()
  }

  private companion object {
    const val APP_PACKAGE = "ninja.domi.webdavautoupload"
    const val UI_TIMEOUT = 30_000L
    const val DEVELOPER_MENU_TIMEOUT = 10_000L
  }
}
