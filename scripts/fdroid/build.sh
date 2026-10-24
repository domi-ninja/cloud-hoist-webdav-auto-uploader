#!/usr/bin/env sh
# Build one unsigned F-Droid candidate. Never signs, installs, uploads, or changes versions.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
sh "$SCRIPT_DIR/prepare.sh"
sh "$SCRIPT_DIR/assemble.sh"
