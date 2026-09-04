#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$SCRIPT_DIR")
APP_ID=ninja.domi.webdavautoupload

. "$SCRIPT_DIR/android-env.sh"

EMULATOR_SERIAL=${ANDROID_SERIAL:-$(adb devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { print $1; exit }')}
if [ -z "$EMULATOR_SERIAL" ]; then
  printf '%s\n' "No running Android emulator was found." >&2
  exit 1
fi

cd "$PROJECT_ROOT"
NODE_ENV=production ./android/gradlew -p android :app:assembleRelease
adb -s "$EMULATOR_SERIAL" install -r android/app/build/outputs/apk/release/app-release.apk >/dev/null

assert_cold_link() {
  uri=$1
  expected_text=$2
  adb -s "$EMULATOR_SERIAL" shell am force-stop "$APP_ID"
  adb -s "$EMULATOR_SERIAL" shell am start -W \
    -a android.intent.action.VIEW \
    -d "$uri" \
    "$APP_ID" >/dev/null

  attempts=0
  while [ "$attempts" -lt 15 ]; do
    adb -s "$EMULATOR_SERIAL" shell uiautomator dump /sdcard/webdav-deep-link.xml >/dev/null 2>&1 || true
    if adb -s "$EMULATOR_SERIAL" shell cat /sdcard/webdav-deep-link.xml 2>/dev/null |
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

printf '%s\n' "Cold-start deep links opened Activity and Sources on $EMULATOR_SERIAL."
