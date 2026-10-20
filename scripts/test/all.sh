#!/usr/bin/env sh

# Runs every check required before committing application changes as one command.
# Use `pnpm check phone` or `pnpm check emu`; the selector is forwarded to deep-link tests.
# Includes a destructive clean-install stress run on BOTH phone and emulator.
# Stress fixtures are isolated; this app's local account/configuration is reset.

set -eu

pnpm typecheck
pnpm lint
pnpm test
pnpm test:publish
pnpm test:release
pnpm test:native
pnpm test:android "${1:-emu}"
pnpm test:deep-links "${1:-emu}"
pnpm test:privacy
pnpm test:stress
