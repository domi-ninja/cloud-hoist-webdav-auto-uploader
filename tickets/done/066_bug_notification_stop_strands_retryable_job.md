# 066 Bug: notification stop action strands a retryable job

Status: done

## Found while

Reviewing foreground notification behavior before committing it.

## Symptom

Cancelling the WorkManager request directly stops the stream and returns its Room job to retry-wait, but it also cancels the only work request that would retry that job.

## Cause

The notification action used WorkManager's generic cancel pending intent without recording user intent or arranging continuation work.

## Fix

Make the action an explicit global pause. A private broadcast receiver persists the paused state before cancelling queue work. The existing resume command clears that state and requests a fresh queue drain.

## Acceptance criteria

- The notification action persists a paused state.
- Active queue work is cancelled safely.
- Resuming creates new queue work for the preserved job.
- External apps cannot invoke the receiver.

## Open question

**Question:** Should the notification cancel only the current file?

**Default:** No. Use the already-supported global pause semantics until per-job cancellation and server cleanup are implemented together.
