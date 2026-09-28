#!/usr/bin/env sh

# Builds a bundled test-only APK, then stress-tests a phone and emulator concurrently.
# Seeds 2,000+ photos before uninstalling/reinstalling THIS APP on each selected target.
# Requires test-creds.tct; only run-owned local/remote fixtures are cleaned up.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/../android/env.sh"
node "$SCRIPT_DIR/stress.mjs" "$@"
