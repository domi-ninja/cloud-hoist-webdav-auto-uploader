# 076 Source removal can leak URI grant

Status: in progress

Found while: completing ticket 013 interrupted cleanup verification

## Problem

Removing a SAF source deletes its Room records before releasing the persisted Android URI grant. If the process dies between those operations, the source is gone and no state remains to identify the grant, so the app retains access indefinitely.

## Fix

- Persist the source ID and URI before deleting the last source that uses a grant.
- On startup, release the grant only when the source deletion committed and no remaining source uses the URI.
- If deletion never committed, clear the pending marker without releasing access.
- Keep recovery idempotent when Android reports that a grant was already released.

## Acceptance criteria

- Normal removal releases an unshared SAF grant.
- Process death after database deletion releases the grant on next startup.
- Process death before database deletion preserves the source and its grant.
- Shared SAF grants remain until the last source using them is removed.
