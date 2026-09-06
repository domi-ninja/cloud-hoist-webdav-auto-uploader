# 063 Bug: failed chunk finalization leaks its staged file

Status: done

## Found while

Reviewing permanent-failure cleanup for the chunked upload coordinator.

## Symptom

If Nextcloud assembles the upload into the hidden staged destination but the final overwrite fails, cleanup deletes the upload collection only. The assembled staged file remains in the destination folder.

## Cause

Chunk abort treated the server-side upload collection as the only temporary resource. Safe overwrite intentionally creates a second temporary resource after assembly.

## Fix

Delete both the upload collection and the deterministic hidden staging path. Attempt both deletions even when the first one fails, and accept already-missing resources.

## Acceptance criteria

- Abort attempts to remove the chunk session.
- Abort also attempts to remove the assembled staging file.
- A failure deleting one target does not prevent attempting the other.

## Open question

**Question:** Should transient interruption also delete the staged file?

**Default:** No. Retryable interruption retains resumable state. Cleanup runs when the job reaches a definite permanent failure or stops using chunking.
