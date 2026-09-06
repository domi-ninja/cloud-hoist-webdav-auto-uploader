#!/usr/bin/env sh

# Prepares the complete project with its pinned Node, pnpm, dependencies, JDK, and Android SDK.
# Run `./scripts/setup.sh` from a fresh checkout; repeated runs keep installed components.
# This installs user-local tools, downloads project dependencies, and creates medium_phone.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname "$SCRIPT_DIR")
NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"

if [ ! -s "$NVM_SCRIPT" ]; then
  printf '%s\n' "nvm is missing. Install it before running project setup." >&2
  exit 1
fi

. "$NVM_SCRIPT"
nvm install
nvm use
corepack enable
corepack prepare pnpm@11.3.0 --activate

cd "$PROJECT_ROOT"
pnpm install --frozen-lockfile

USER_BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
export PATH="$USER_BIN_DIR:$PATH"

if ! command -v android >/dev/null 2>&1; then
  ANDROID_CLI_INSTALLER=$(mktemp "${TMPDIR:-/tmp}/android-cli-install.XXXXXX")
  trap 'rm -f "$ANDROID_CLI_INSTALLER"' EXIT HUP INT TERM
  curl -fsSL https://dl.google.com/android/cli/latest/linux_x86_64/install.sh \
    -o "$ANDROID_CLI_INSTALLER"
  bash "$ANDROID_CLI_INSTALLER"
fi

PROJECT_JDK="${XDG_DATA_HOME:-$HOME/.local/share}/jdks/temurin-21.0.12.1+1"
if ! command -v javac >/dev/null 2>&1 && [ ! -x "$PROJECT_JDK/bin/javac" ]; then
  JDK_VERSION='21.0.12.1+1'
  JDK_SHA256='ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94'
  JDK_URL='https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz'
  JDK_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/webdav-auto-upload"
  JDK_ARCHIVE="$JDK_CACHE_DIR/temurin-$JDK_VERSION.tar.gz"

  if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
    printf '%s\n' 'The automatic JDK installer supports Linux x86-64 only.' >&2
    exit 1
  fi

  mkdir -p "$JDK_CACHE_DIR" "$PROJECT_JDK"
  curl -fL "$JDK_URL" -o "$JDK_ARCHIVE"
  printf '%s  %s\n' "$JDK_SHA256" "$JDK_ARCHIVE" | sha256sum --check
  tar -xzf "$JDK_ARCHIVE" -C "$PROJECT_JDK" --strip-components=1
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

. "$SCRIPT_DIR/android/env.sh"

printf '%s\n' "Android SDK: $ANDROID_HOME"
printf '%s\n' "Java: $JAVA_HOME"
printf '%s\n' "AVD: medium_phone"
printf '%s\n' "Project setup complete. Run pnpm android emu or pnpm android phone."
