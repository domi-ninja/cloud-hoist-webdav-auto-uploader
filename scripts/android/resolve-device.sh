#!/usr/bin/env sh

# Selects one online Android target for scripts that install, launch, or test the app.
# Set ANDROID_SERIAL to a value from `adb devices -l` when multiple targets are connected.
# Prints only the selected serial so callers can safely pass it to `adb -s` or Gradle.

set -eu

CONNECTED_SERIALS=$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')

if [ -n "${ANDROID_SERIAL:-}" ]; then
  if printf '%s\n' "$CONNECTED_SERIALS" | grep -Fxq "$ANDROID_SERIAL"; then
    printf '%s\n' "$ANDROID_SERIAL"
    exit 0
  fi

  printf '%s\n' "ANDROID_SERIAL '$ANDROID_SERIAL' is not an online Android target." >&2
  adb devices -l >&2
  exit 1
fi

TARGET_COUNT=$(printf '%s\n' "$CONNECTED_SERIALS" | awk 'NF { count += 1 } END { print count + 0 }')

case "$TARGET_COUNT" in
  0)
    printf '%s\n' "No online Android target was found." >&2
    exit 1
    ;;
  1)
    printf '%s\n' "$CONNECTED_SERIALS"
    ;;
  *)
    printf '%s\n' "More than one Android target is online. Select one with ANDROID_SERIAL:" >&2
    adb devices -l >&2
    printf '%s\n' "Example: ANDROID_SERIAL=emulator-5554 pnpm android" >&2
    exit 1
    ;;
esac
