#!/usr/bin/env sh

# Runs local JVM unit tests for the native upload engine without using an Android target.
# Use `pnpm test:native`; the script creates the ignored Android project when it is absent.
# It still loads the pinned Android SDK and JDK because Gradle configures the native module.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$(dirname "$SCRIPT_DIR")")

. "$SCRIPT_DIR/../android/env.sh"

if [ ! -x "$PROJECT_ROOT/android/gradlew" ]; then
  (
    cd "$PROJECT_ROOT"
    pnpm exec expo prebuild --platform android
  )
fi

cd "$PROJECT_ROOT/android"
./gradlew :webdav-upload-engine:testDebugUnitTest
