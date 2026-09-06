#!/usr/bin/env sh

# Selects one online Android target for scripts that install, launch, or test the app.
# Pass `phone` or `emu` to choose the first target of that type, or set ANDROID_SERIAL exactly.
# Prints only the selected serial so callers can safely pass it to `adb -s` or Gradle.

set -eu

CONNECTED_SERIALS=$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
TARGET_KIND=${1:-}

if [ "$#" -gt 1 ]; then
  printf '%s\n' "Usage: $0 [phone|emu]" >&2
  exit 1
fi

case "$TARGET_KIND" in
  phone)
    TARGET_SERIAL=$(printf '%s\n' "$CONNECTED_SERIALS" | awk '$0 !~ /^emulator-/ { print; exit }')
    ;;
  emu)
    TARGET_SERIAL=$(printf '%s\n' "$CONNECTED_SERIALS" | awk '$0 ~ /^emulator-/ { print; exit }')
    ;;
  '')
    TARGET_SERIAL=''
    ;;
  *)
    printf '%s\n' "Unknown Android target '$TARGET_KIND'. Use phone or emu." >&2
    exit 1
    ;;
esac

if [ -n "$TARGET_KIND" ]; then
  if [ -n "$TARGET_SERIAL" ]; then
    printf '%s\n' "$TARGET_SERIAL"
    exit 0
  fi

  printf '%s\n' "No online Android $TARGET_KIND target was found." >&2
  adb devices -l >&2
  exit 1
fi

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
    printf '%s\n' "Use 'pnpm android phone' or 'pnpm android emu'." >&2
    exit 1
    ;;
esac
