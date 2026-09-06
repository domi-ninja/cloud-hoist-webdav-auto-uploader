#!/usr/bin/env sh

# Runs the live Nextcloud login, process-death, and upload acceptance flow.
# Use `pnpm test:account:live` with local test-creds.tct and an online Android target.
# Set ANDROID_SERIAL when multiple targets are online; this test clears the app's target data.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/../android/env.sh"

node "$SCRIPT_DIR/account-acceptance.mjs"
