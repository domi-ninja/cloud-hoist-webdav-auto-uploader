#!/usr/bin/env sh

# Builds a release APK and checks cold-start Sources and Activity links on one Android target.
# Use `pnpm test:deep-links`; set ANDROID_SERIAL when multiple targets are online.
# The script installs the release app over the selected target's existing app installation.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$(dirname "$SCRIPT_DIR")")
APP_ID=ninja.domi.webdavautoupload

. "$SCRIPT_DIR/../android/env.sh"

TARGET_SERIAL=$("$SCRIPT_DIR/../android/resolve-device.sh")

cd "$PROJECT_ROOT"
NODE_ENV=production ./android/gradlew -p android :app:assembleRelease
adb -s "$TARGET_SERIAL" install -r android/app/build/outputs/apk/release/app-release.apk >/dev/null

assert_cold_link() {
  uri=$1
  expected_text=$2
  adb -s "$TARGET_SERIAL" shell am force-stop "$APP_ID"
  adb -s "$TARGET_SERIAL" shell am start -W \
    -a android.intent.action.VIEW \
    -d "$uri" \
    "$APP_ID" >/dev/null

  attempts=0
  while [ "$attempts" -lt 15 ]; do
    adb -s "$TARGET_SERIAL" shell uiautomator dump /sdcard/webdav-deep-link.xml >/dev/null 2>&1 || true
    if adb -s "$TARGET_SERIAL" shell cat /sdcard/webdav-deep-link.xml 2>/dev/null |
      grep -Fq "text=\"$expected_text\""; then
      return
    fi
    attempts=$((attempts + 1))
    sleep 1
  done

  printf '%s\n' "Cold link $uri did not show '$expected_text'." >&2
  exit 1
}

assert_cold_link "webdav-auto-upload:///activity" "Recent"
assert_cold_link "webdav-auto-upload:///" "Automatic uploads for Nextcloud."

printf '%s\n' "Cold-start deep links opened Activity and Sources on $TARGET_SERIAL."
