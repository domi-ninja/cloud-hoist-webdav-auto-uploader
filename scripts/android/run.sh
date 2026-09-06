#!/usr/bin/env sh

# Builds, installs, and launches the Expo development client on one Android target.
# Run with `pnpm android`; set ANDROID_SERIAL when a phone and emulator are both online.
# If no target is online and no serial was requested, this starts the medium_phone emulator.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/env.sh"

if [ -z "${ANDROID_SERIAL:-}" ] &&
  ! adb devices | awk 'NR > 1 && $2 == "device" { found = 1 } END { exit !found }'; then
  if ! command -v android >/dev/null 2>&1; then
    printf '%s\n' "No Android target is online and Android CLI is unavailable." >&2
    exit 1
  fi

  android emulator start medium_phone
fi

TARGET_SERIAL=$("$SCRIPT_DIR/resolve-device.sh")

case "$TARGET_SERIAL" in
  emulator-*)
    EXPO_DEVICE_NAME=$(adb -s "$TARGET_SERIAL" emu avd name | sed -n '1p' | tr -d '\r')
    ;;
  *)
    EXPO_DEVICE_NAME=$(adb devices -l | awk -v serial="$TARGET_SERIAL" '
      $1 == serial {
        for (index = 3; index <= NF; index += 1) {
          if ($index ~ /^model:/) {
            sub(/^model:/, "", $index)
            print $index
            exit
          }
        }
      }
    ')
    ;;
esac

if [ -z "$EXPO_DEVICE_NAME" ]; then
  printf '%s\n' "Could not determine Expo's device name for $TARGET_SERIAL." >&2
  exit 1
fi

ANDROID_SERIAL="$TARGET_SERIAL" EXPO_UNSTABLE_HEADLESS=1 \
  pnpm exec expo run:android --device "$EXPO_DEVICE_NAME"
