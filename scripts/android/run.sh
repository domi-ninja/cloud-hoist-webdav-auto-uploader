#!/usr/bin/env sh

# Builds, installs, and launches the Expo development client on one Android target.
# Run with `pnpm android phone` or `pnpm android emu`; ANDROID_SERIAL selects an exact target.
# The emu selector starts medium_phone when needed. With one target, no selector is required.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/env.sh"

TARGET_KIND=${1:-}

case "$TARGET_KIND" in
  emu)
    NEEDS_EMULATOR=$(adb devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { found = 1 } END { print found ? "no" : "yes" }')
    ;;
  phone|'')
    NEEDS_EMULATOR=no
    ;;
  *)
    NEEDS_EMULATOR=no
    ;;
esac

if [ -z "$TARGET_KIND" ] && [ -z "${ANDROID_SERIAL:-}" ] &&
  ! adb devices | awk 'NR > 1 && $2 == "device" { found = 1 } END { exit !found }'; then
  NEEDS_EMULATOR=yes
fi

if [ "$NEEDS_EMULATOR" = yes ]; then
  if ! command -v android >/dev/null 2>&1; then
    printf '%s\n' "No Android target is online and Android CLI is unavailable." >&2
    exit 1
  fi

  android emulator start medium_phone
fi

TARGET_SERIAL=$("$SCRIPT_DIR/resolve-device.sh" "$@")

case "$TARGET_SERIAL" in
  emulator-*)
    EXPO_DEVICE_NAME=$(adb -s "$TARGET_SERIAL" emu avd name | sed -n '1p' | tr -d '\r')
    ;;
  *)
    EXPO_DEVICE_NAME=$(adb devices -l | awk -v serial="$TARGET_SERIAL" '
      $1 == serial {
        for (field_number = 3; field_number <= NF; field_number += 1) {
          if ($field_number ~ /^model:/) {
            sub(/^model:/, "", $field_number)
            print $field_number
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
