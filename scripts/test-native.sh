#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$SCRIPT_DIR")

. "$SCRIPT_DIR/android-env.sh"

if [ ! -x "$PROJECT_ROOT/android/gradlew" ]; then
  (
    cd "$PROJECT_ROOT"
    pnpm exec expo prebuild --platform android
  )
fi

cd "$PROJECT_ROOT/android"
./gradlew :webdav-upload-engine:testDebugUnitTest
