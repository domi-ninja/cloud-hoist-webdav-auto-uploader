# 013 Add cleanup and private diagnostics

Status: blocked by 012

Depends on: 003, 006, 009, 010, 012

## Outcome

Users can understand failures, export a safe diagnostic report, remove a source, and sign out without leaving credentials or private local records behind.

## Work

- Implement a bounded local diagnostic log with structured event codes, timestamps, engine versions, Android state, and redacted error context.
- Never record credentials, authorization headers, polling tokens, full local paths, or remote filenames.
- Generate an exportable text or JSON report after a second redaction pass. Let the user preview the categories included before sharing.
- Confirm source removal when unfinished work exists. Cancel its unique scan work, delete its Room records transactionally, and release its persisted SAF permission when no source uses it.
- Do not delete local content, remote content, or remote completed uploads during source removal.
- Implement confirmed sign-out: pause the engine, cancel scheduled work, stop new claims, best-effort clean known temporary sessions, wipe Room records, then remove credentials.
- Make interrupted sign-out idempotent so reopening the app finishes local cleanup.
- Clear completed history without touching queued, retrying, or blocked jobs.
- Verify the production dependency graph contains no analytics, advertising identifier, or hosted crash-reporting SDK.
- Add the independent-project compatibility notice and GPL license information to About.

## Acceptance criteria

- Diagnostic export contains enough state to identify scheduling and blocker problems without exposing secret or filename data.
- Automated redaction tests cover URLs with user info, HTTP headers, query tokens, Android URIs, paths, filenames, and nested exception messages.
- Source removal clears only that source's records and work.
- Sign-out leaves no account secret, source, queue, history, or scheduled work after completion or interrupted recovery.
- Clear history cannot remove unfinished work.
- No cleanup path touches local or successfully uploaded remote files.
- A dependency and manifest review finds no telemetry or advertising collection.

## Verification

- Seed diagnostic events with fake secrets and assert exported output contains none.
- Interrupt source removal and sign-out at controlled phases, restart, and confirm consistent cleanup.
- Inspect WorkManager, Room, encrypted storage, and persisted URI grants after sign-out.

## Not in this ticket

- Remote cleanup guarantees after credentials disappear
- Hosted support upload
- Analytics or crash reporting
- User-configurable log retention

## Open question

**Question:** How much local diagnostic history should the app retain?

**Default:** Keep a rolling seven days capped at 2 MiB, whichever limit is reached first.
