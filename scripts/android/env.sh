#!/usr/bin/env sh

# Resolves the Android SDK and a complete JDK, then exports the build environment.
# Source this file from Android build and test scripts. Run `pnpm android:setup` if it fails.

set -eu

resolve_android_sdk() {
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then
    printf '%s\n' "$ANDROID_HOME"
    return
  fi

  if ! command -v android >/dev/null 2>&1; then
    printf '%s\n' "Android CLI is missing. Run the install command in README.md." >&2
    return 1
  fi

  android info | sed -n 's/^sdk: //p' | head -n 1
}

resolve_java_home() {
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ] && [ -x "$JAVA_HOME/bin/javac" ]; then
    printf '%s\n' "$JAVA_HOME"
    return
  fi

  PROJECT_JDK="${XDG_DATA_HOME:-$HOME/.local/share}/jdks/temurin-21.0.12.1+1"
  if [ -x "$PROJECT_JDK/bin/java" ] && [ -x "$PROJECT_JDK/bin/javac" ]; then
    printf '%s\n' "$PROJECT_JDK"
    return
  fi

  if command -v javac >/dev/null 2>&1; then
    JAVAC_PATH=$(readlink -f "$(command -v javac)")
    dirname "$(dirname "$JAVAC_PATH")"
    return
  fi

  printf '%s\n' 'A complete JDK 21 is missing. Run pnpm android:setup.' >&2
  return 1
}

ANDROID_PROJECT_SDK=$(resolve_android_sdk)
ANDROID_PROJECT_JAVA_HOME=$(resolve_java_home)

if [ -z "$ANDROID_PROJECT_SDK" ] || [ ! -d "$ANDROID_PROJECT_SDK" ]; then
  printf '%s\n' "Could not find an Android SDK." >&2
  exit 1
fi

export ANDROID_HOME="$ANDROID_PROJECT_SDK"
export ANDROID_SDK_ROOT="$ANDROID_PROJECT_SDK"
export JAVA_HOME="$ANDROID_PROJECT_JAVA_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_PROJECT_SDK/platform-tools:$ANDROID_PROJECT_SDK/emulator:$PATH"
