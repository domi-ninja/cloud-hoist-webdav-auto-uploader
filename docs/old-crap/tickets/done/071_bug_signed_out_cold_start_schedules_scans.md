# 071 Keep signed-out cold starts idle

Status: done

Found while working on: 013

## Bug

The native module unconditionally registered the media observer and periodic
reconciliation worker whenever React Native created it. A user who signed out
would therefore get background scan work again after the next cold start.

## Impact

Sign-out looked complete in the current process but did not preserve its idle
state across an app restart. The unnecessary work could wake the app despite
there being no account or upload source.

## Fix

Only restore persistent worker registrations at module creation when encrypted
account metadata is present. Account/source setup remains responsible for
scheduling work after connection.

## Acceptance criteria

- Creating the native module without an account schedules no engine work.
- Existing connected accounts still restore their persistent workers.
- Kotlin compilation succeeds with the account guard in the module lifecycle.
