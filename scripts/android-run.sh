#!/usr/bin/env sh

set -eu

. "$(dirname "$0")/android-env.sh"

if ! adb devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { found = 1 } END { exit !found }'; then
  if ! command -v android >/dev/null 2>&1; then
    printf '%s\n' "No emulator is running and Android CLI is unavailable." >&2
    exit 1
  fi

  android emulator start medium_phone
fi

EMULATOR_SERIAL=$(adb devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { print $1; exit }')

if [ -z "$EMULATOR_SERIAL" ]; then
  printf '%s\n' "The Android emulator did not become ready." >&2
  exit 1
fi

ANDROID_SERIAL="$EMULATOR_SERIAL" EXPO_UNSTABLE_HEADLESS=1 pnpm exec expo run:android
