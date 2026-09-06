#!/usr/bin/env sh

# Downloads and verifies the pinned Temurin JDK when the project cannot find a compiler.
# `pnpm android:setup` calls this automatically; direct use supports Linux x86-64 only.
# The archive is cached and the JDK is installed under the user's local data directory.

set -eu

JDK_VERSION='21.0.12.1+1'
JDK_SHA256='ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94'
JDK_URL='https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz'
JDK_DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/jdks/temurin-$JDK_VERSION"
JDK_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/webdav-auto-upload"
JDK_ARCHIVE="$JDK_CACHE_DIR/temurin-$JDK_VERSION.tar.gz"

if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  printf '%s\n' 'The automatic JDK installer currently supports Linux x86_64 only.' >&2
  exit 1
fi

if [ -x "$JDK_DATA_DIR/bin/java" ] && [ -x "$JDK_DATA_DIR/bin/javac" ]; then
  printf '%s\n' "JDK already installed: $JDK_DATA_DIR"
  exit 0
fi

mkdir -p "$JDK_CACHE_DIR" "$JDK_DATA_DIR"
curl -fL "$JDK_URL" -o "$JDK_ARCHIVE"
printf '%s  %s\n' "$JDK_SHA256" "$JDK_ARCHIVE" | sha256sum --check
tar -xzf "$JDK_ARCHIVE" -C "$JDK_DATA_DIR" --strip-components=1

"$JDK_DATA_DIR/bin/java" -version
"$JDK_DATA_DIR/bin/javac" -version
