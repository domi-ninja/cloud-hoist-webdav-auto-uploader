#!/usr/bin/env sh

# Runs the upload engine's Android instrumentation tests on one connected target.
# Use `pnpm test:android phone|emu`; ANDROID_SERIAL selects an exact target.
# Gradle installs test packages and may change this app's data on the selected target.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$(dirname "$SCRIPT_DIR")")

. "$SCRIPT_DIR/../android/env.sh"

TARGET_SERIAL=$("$SCRIPT_DIR/../android/resolve-device.sh" "$@")

cd "$PROJECT_ROOT/android"
ANDROID_SERIAL="$TARGET_SERIAL" ./gradlew :webdav-upload-engine:connectedDebugAndroidTest
