#!/usr/bin/env sh

set -eu

if ! command -v android >/dev/null 2>&1; then
  printf '%s\n' "Install Google's Android CLI first. See README.md." >&2
  exit 1
fi

PROJECT_JDK="${XDG_DATA_HOME:-$HOME/.local/share}/jdks/temurin-21.0.12.1+1"
if ! command -v javac >/dev/null 2>&1 && [ ! -x "$PROJECT_JDK/bin/javac" ]; then
  "$(dirname "$0")/install-jdk.sh"
fi

android sdk install platforms/android-36
android sdk install build-tools/36.0.0
android sdk install build-tools/35.0.0
android sdk install ndk/27.1.12297006
android sdk install cmake/3.22.1
android sdk install platform-tools
android sdk install emulator
android sdk install system-images/android-36/google_apis_playstore/x86_64

if ! android emulator list | grep -Fxq medium_phone; then
  android emulator create medium_phone
fi

. "$(dirname "$0")/android-env.sh"

printf '%s\n' "Android SDK: $ANDROID_HOME"
printf '%s\n' "Java: $JAVA_HOME"
printf '%s\n' "AVD: medium_phone"
printf '%s\n' "Run pnpm android to build, install, and launch the app."
