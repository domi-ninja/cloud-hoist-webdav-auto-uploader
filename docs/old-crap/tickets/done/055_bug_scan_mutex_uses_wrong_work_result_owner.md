# 055 Bug: scan mutex uses wrong WorkManager result owner

Status: done

## Found while

Compiling ticket 009's mutual exclusion for simultaneous scan workers.

## Symptom

Kotlin cannot resolve `Worker.Result`, and the media worker's result chain consequently has no inferred type.

## Cause

WorkManager declares `Result` on `ListenableWorker`. Subclasses can use the inherited short name inside their methods, but a top-level helper cannot qualify it through `Worker`.

## Fix

- Type the top-level scan-lock helper with `ListenableWorker.Result`.
- Keep worker bodies using the inherited `Result` shorthand.

## Acceptance criteria

- The native module compiles with the scan mutex enabled.
- Both media and reconciliation workers return a WorkManager result through the helper.

## Open question

**Question:** Should the mutex helper return a custom result type instead?

**Default:** No. It exists only at the WorkManager boundary, so the native result type is the smallest clear contract.
