#!/usr/bin/env sh
# Signs or verifies local validation APKs using the existing key. Never publishes.
# Usage: pnpm android:signing; pnpm android:release; sh scripts/android/release.sh verify
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR/../.."
. "$SCRIPT_DIR/env.sh"
exec node scripts/android/release.mjs "$@"
