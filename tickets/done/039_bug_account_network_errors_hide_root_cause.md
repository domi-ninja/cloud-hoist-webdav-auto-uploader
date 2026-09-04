# 039 Account network errors hide the actionable cause

Status: complete

Found while working on: 003

## Bug

The account client maps DNS failures, timeouts, and refused connections to the
same `ERR_ACCOUNT_NETWORK` result.

## Impact

The app cannot tell a user whether Android failed to resolve the host, the server
timed out, or nothing accepted the connection. Emulator failures are needlessly
hard to diagnose too.

## Fix

Classify common Java networking exceptions before the general `IOException`
fallback and expose stable, secret-free codes through the TypeScript boundary.

## Acceptance criteria

- Unknown hosts, socket timeouts, and refused connections have distinct codes.
- Other I/O failures retain the general network code.
- Tests prove that none of the resulting messages contain request secrets.

## Open question

**Question:** Should these errors include the failing hostname?

**Default:** No. Keep native errors free of account identifiers and let the UI
show the server value it already owns.
