#!/usr/bin/env sh

# Runs every check required before committing application changes as one command.
# Use `pnpm check phone` or `pnpm check emu`; the selector is forwarded to deep-link tests.
# The run includes TypeScript, lint, Jest, native unit, deep-link, and privacy checks.

set -eu

pnpm typecheck
pnpm lint
pnpm test
pnpm test:native
pnpm test:deep-links "$@"
pnpm test:privacy
