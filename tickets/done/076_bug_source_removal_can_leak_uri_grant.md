# 076 Source removal can leak URI grant

Status: completed

Found while: completing ticket 013 interrupted cleanup verification

## Problem

Removing a SAF source deleted its Room records before releasing the persisted Android URI grant. If the process died between those operations, the source was gone and no state remained to identify the grant, so the app retained access indefinitely.

## Resolution

- Persisted the source ID and URI before deleting the last source that uses a grant.
- Startup recovery releases the grant only when source deletion committed and no remaining source uses the URI.
- Recovery clears the marker without releasing access when deletion did not commit.
- Grant release remains idempotent when Android reports that access is already gone.

## Verification

`SourceRemovalCleanupTest` covers normal removal, interruption before deletion, interruption after deletion, and two sources sharing one grant. All four cases pass on `emulator-5554`.
