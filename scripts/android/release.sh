#!/usr/bin/env sh
# Creates private signing credentials or builds a signed beta. Never installs on devices.
# Usage: pnpm android:signing; pnpm android:beta; sh scripts/android/release.sh verify
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR/../.."
. "$SCRIPT_DIR/env.sh"
exec node scripts/android/release.mjs "$@"
