#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$SCRIPT_DIR")

. "$SCRIPT_DIR/android-env.sh"

if ! adb devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { found = 1 } END { exit !found }'; then
  printf '%s\n' "No running Android emulator was found." >&2
  exit 1
fi

cd "$PROJECT_ROOT/android"
./gradlew :webdav-upload-engine:connectedDebugAndroidTest
