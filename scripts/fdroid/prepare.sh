#!/usr/bin/env sh
# Generate the native project from locked source without signing keys or an Expo account.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR/../.."
export CI=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 TZ=UTC
node scripts/android/release.mjs identity >/dev/null
pnpm exec expo prebuild --platform android --no-install
python3 scripts/fdroid/prepare-source.py
