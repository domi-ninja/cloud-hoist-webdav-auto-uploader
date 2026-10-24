#!/usr/bin/env sh

# Install the signed validation APK in place and launch it. Never uninstall or clear device data.
# Usage: pnpm android:install [phone]; ANDROID_SERIAL selects a specific connected phone.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR/../.."
. "$SCRIPT_DIR/env.sh"
if [ -n "${ANDROID_SERIAL:-}" ]; then
  TARGET_SERIAL=$("$SCRIPT_DIR/resolve-device.sh")
else
  TARGET_SERIAL=$("$SCRIPT_DIR/resolve-device.sh" "$@")
fi
case "$TARGET_SERIAL" in
  emulator-*) printf '%s\n' 'This command installs on a physical phone only.' >&2; exit 1 ;;
esac
APK_PATH=$(node -p '"dist/cloud-hoist-" + require("./app.json").expo.version + ".apk"')
if [ ! -f "$APK_PATH" ]; then
  printf '%s\n' 'Build with pnpm fdroid:build, then sign with pnpm android:release.' >&2
  exit 1
fi
node scripts/android/release.mjs verify "$APK_PATH"
APP_PACKAGE=$(node -p 'require("./app.json").expo.android.package')
adb -s "$TARGET_SERIAL" install -r "$APK_PATH"
adb -s "$TARGET_SERIAL" shell am start -n "$APP_PACKAGE/.MainActivity"
