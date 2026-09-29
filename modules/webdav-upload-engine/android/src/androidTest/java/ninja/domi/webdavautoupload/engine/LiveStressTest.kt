package ninja.domi.webdavautoupload.engine

import android.content.ContentValues
import android.content.ClipData
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LiveStressTest {
  private var screenshotVariant = "normal"
  private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
  private val context get() = instrumentation.context
  private val args get() = InstrumentationRegistry.getArguments()
  private fun runId(): String {
    val run = args.getString("stressRun")
    assumeTrue("Run through pnpm test:stress", run != null)
    require(run!!.matches(Regex("stress-[a-z0-9-]+")))
    return run
  }

  @Test fun seedPhotos() {
    val run = runId()
    val count = args.getString("photoCount")!!.toInt().also { require(it in 2000..20000) }
    val sampleDir = File(context.filesDir, run)
    val samples = sampleDir.listFiles().orEmpty().filter { it.extension == "jpg" }.sortedBy { it.name }
    require(samples.isNotEmpty()) { "Photo samples are missing from the test app's private fixture directory" }
    val paint = Paint().apply { color = Color.WHITE; textSize = 24f; isAntiAlias = true }
    val bitmap = Bitmap.createBitmap(480, 360, Bitmap.Config.RGB_565)
    val canvas = Canvas(bitmap)
    val originals = samples.map { requireNotNull(BitmapFactory.decodeFile(it.path)) }
    try {
      repeat(count) { index ->
        canvas.drawBitmap(originals[index % originals.size], null, android.graphics.Rect(0, 0, 480, 360), null)
        canvas.drawRect(0f, 310f, 480f, 360f, Paint().apply { color = Color.BLACK })
        canvas.drawText("$run / $index", 8f, 340f, paint)
        val values = ContentValues().apply {
          put(MediaStore.Images.Media.DISPLAY_NAME, "$run-${index.toString().padStart(5, '0')}.jpg")
          put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
          put(MediaStore.Images.Media.RELATIVE_PATH, if (index % 2 == 0) "DCIM/Camera/" else "Pictures/Screenshots/")
          put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val uri = requireNotNull(context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values))
        context.contentResolver.openOutputStream(uri)!!.use { check(bitmap.compress(Bitmap.CompressFormat.JPEG, 80, it)) }
        context.contentResolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
        if ((index + 1) % 250 == 0) instrumentation.sendStatus(0, Bundle().apply { putString("stream", "Seeded ${index + 1}/$count photos\n") })
      }
    } finally { bitmap.recycle(); originals.forEach(Bitmap::recycle) }
    context.contentResolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, arrayOf("_id"), "_display_name LIKE ?", arrayOf("$run-%"), null)!!.use { check(it.count == count) }
  }

  @Test fun grantAccess() {
    val run = runId()
    val tree = Uri.parse("content://ninja.domi.webdavautoupload.stress-documents/tree/$run")
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("webdav-auto-upload:///"))
      .setPackage(APP).apply { clipData = ClipData.newRawUri("Stress photos", tree) }
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION or
        Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION))
    // Consume the offered persisted grant before instrumentation releases transient grants.
    val setup = UiDevice.getInstance(instrumentation).executeShellCommand(
      "content call --uri content://$APP.account-acceptance --method stressSetup --arg $run")
    assertTrue("App could not retain the fixture folder grant: $setup", setup.contains("status=ok"))
  }

  @Test fun freshInstallUi() {
    runId()
    val device = UiDevice.getInstance(instrumentation)
    device.wakeUp()
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("webdav-auto-upload:///"))
      .setPackage(APP).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
    val manual = device.wait(Until.findObject(By.desc("Use app credentials instead")), TIMEOUT)
    assertTrue("Fresh install did not reach account setup", manual != null)
    manual.click()
    val connect = device.wait(Until.findObject(By.desc("Connect with app password")), TIMEOUT)
    assertTrue("Manual account controls unavailable", connect != null)
    connect.click()
    assertTrue(device.wait(Until.hasObject(By.text("Server URL, username, and app password are required.")), TIMEOUT))
  }

  @Test fun cleanupPhotos() {
    val run = runId()
    context.contentResolver.delete(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "_display_name LIKE ?", arrayOf("$run-%"))
    File(context.filesDir, run).deleteRecursively()
  }

  @Test fun exerciseUnderLoad() {
    val run = runId()
    val device = UiDevice.getInstance(instrumentation)
    val oldFont = device.executeShellCommand("settings get system font_scale").trim()
    val oldNight = device.executeShellCommand("cmd uimode night").substringAfter("Night mode: ").trim()
    // Starting instrumentation restarts its APK. Begin transfers only once its fixture provider is available.
    val resumed = device.executeShellCommand("content call --uri content://$APP.account-acceptance --method stressResume --arg $run")
    assertTrue(resumed.contains("status=ok"))
    try {
      navigateUnderLoad()
      screenshotVariant = "large-text"
      device.executeShellCommand("settings put system font_scale 1.5")
      navigateUnderLoad()
      if (args.getString("stressEmulator") == "true") {
        screenshotVariant = "dark"
        device.executeShellCommand("settings put system font_scale 1.0")
        device.executeShellCommand("cmd uimode night yes")
        navigateUnderLoad()
      }
    } finally {
      device.executeShellCommand(if (oldFont == "null") "settings delete system font_scale" else "settings put system font_scale $oldFont")
      device.executeShellCommand("cmd uimode night $oldNight")
    }
  }

  private fun navigateUnderLoad() {
    runId()
    val device = UiDevice.getInstance(instrumentation)
    device.wakeUp()
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("webdav-auto-upload:///"))
      .setPackage(APP).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
    fun click(label: String) {
      val item = device.wait(Until.findObject(By.desc(label)), TIMEOUT)
      assertTrue("Control '$label' did not appear", item != null)
      item.click()
    }
    fun text(value: String) { assertTrue("Screen '$value' did not appear", device.wait(Until.hasObject(By.text(value)), TIMEOUT)) }
    fun capture(screen: String) { assertTrue(device.takeScreenshot(File(context.filesDir, "${runId()}/$screenshotVariant-$screen.png"))) }
    text("Backup folders")
    click("Backup camera")
    text("Add backup folder")
    text("/WebDAV Auto Upload/DCIM/Camera")
    assertTrue("Camera preview did not show seeded photos", device.wait(Until.hasObject(By.desc("Files in this backup folder")), TIMEOUT))
    capture("backup-editor")
    click("Choose Screenshots source")
    text("Pictures/Screenshots")
    text("/WebDAV Auto Upload/Pictures/Screenshots")
    assertTrue("Changing a preset lost its folder choices", device.hasObject(By.desc("Choose local folder source")))
    click("Cancel")
    // Selecting a preset initializes the editor, but creates no source until Save.
    device.wait(Until.findObject(By.text("Discard")), 1500)?.click()
    click("Backup screenshots")
    text("Add backup folder")
    text("/WebDAV Auto Upload/Pictures/Screenshots")
    assertTrue("Screenshots preview did not show seeded photos", device.wait(Until.hasObject(By.desc("Files in this backup folder")), TIMEOUT))
    capture("screenshots-editor")
    click("Cancel")
    device.wait(Until.findObject(By.text("Discard")), 1500)?.click()
    click("Actions for Stress photos")
    click("Edit backup folder")
    text("Edit backup folder")
    assertTrue("Save action is missing", device.hasObject(By.desc("Save backup folder")))
    assertTrue("Maintenance does not belong in the editor", !device.hasObject(By.text("Maintenance")))
    assertTrue("The backup toggle belongs on the backup card", !device.hasObject(By.desc("Enable backup folder")))
    assertTrue(device.wait(Until.hasObject(By.desc("Files in this backup folder")), TIMEOUT))
    capture("edit-backup")
    click("Cancel")
    device.wait(Until.findObject(By.text("Discard")), 1500)?.click()
    click("Activity")
    for (attempt in 0 until 8) {
      if (device.hasObject(By.text("Files"))) break
      device.swipe(device.displayWidth / 2, device.displayHeight / 3, device.displayWidth / 2, device.displayHeight * 3 / 4, 10)
    }
    text("Files")
    capture("activity")
    device.findObject(By.desc("Show file filters"))?.click()
    click("Filter files: pending")
    click("Clear filters")
    repeat(6) {
      device.swipe(device.displayWidth / 2, device.displayHeight * 3 / 4, device.displayWidth / 2, device.displayHeight / 3, 30)
      device.waitForIdle(1000)
      device.findObject(By.desc("Show 20 more"))?.click()
    }
    click("Settings")
    text("Nextcloud upload root")
    capture("settings")
    click("Choose upload root")
    text("Choose upload root")
    capture("remote-picker")
    click("Close folder browser")
    click("Account settings")
    text("Replace connection")
    click("Nextcloud server URL")
    assertTrue("Account field did not receive focus", device.wait(Until.hasObject(By.clazz("android.widget.EditText").focused(true)), TIMEOUT))
    val keyboardDeadline = android.os.SystemClock.elapsedRealtime() + 30_000
    while (!device.executeShellCommand("dumpsys input_method").contains("mInputShown=true") && android.os.SystemClock.elapsedRealtime() < keyboardDeadline) {
      android.os.SystemClock.sleep(200)
    }
    assertTrue("Account keyboard did not open", device.executeShellCommand("dumpsys input_method").contains("mInputShown=true"))
    device.waitForIdle(1000)
    capture("account-settings")
    click("Cancel")
    click("Backups")
    text("Backup folders")
    capture("backups")
  }

  private companion object {
    const val APP = "ninja.domi.webdavautoupload"
    const val TIMEOUT = 120_000L
  }
}
