package ninja.domi.cloudhoist.engine

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackgroundAccessTest {
  @Test fun onlyExemptAndUnrestrictedAppsHideTheBatteryAction() {
    assertTrue(isBackgroundUnrestricted(true, false))
    assertFalse(isBackgroundUnrestricted(false, false))
    assertFalse(isBackgroundUnrestricted(true, true))
    assertFalse(isBackgroundUnrestricted(false, true))
  }
}
