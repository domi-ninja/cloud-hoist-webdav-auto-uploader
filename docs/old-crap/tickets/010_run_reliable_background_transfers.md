# 010 Run reliable background transfers

Status: archived specification. Implementation exists; see [current tracking](../../tickets/README.md) for remaining validation and superseding decisions. Historical acceptance criteria below are not a completion claim.

Depends on: 005, 006, 007, 009

## Outcome

The queue worker uploads one file at a time, classifies failures, retries transient problems, blocks on actionable problems, and promotes long work to a foreground service with a useful notification.

## Work

- Claim the oldest eligible job transactionally and upload only one job at a time.
- Limit every worker invocation by elapsed time and completed-job count. Schedule continuation work when eligible jobs remain.
- Recheck constraints before starting each file so a network change does not begin another transfer.
- Retry network errors, timeouts, HTTP 429, server 5xx responses, and uncertain server outcomes with capped exponential backoff and jitter.
- Honor `Retry-After` when the server provides it.
- Block the account on invalid credentials or certificate failures, the source on lost read access, and the job on definite quota, invalid path, or unsupported content failures.
- Never turn a missing local file into success. Record a visible blocker or cancellation reason according to whether the source still reports it.
- Recover abandoned running jobs after process death.
- Promote transfers that exceed ordinary worker limits to a foreground `dataSync` worker and declare the required Android permissions and service type.
- Show filename-safe progress, cancel action, and aggregate queue state in the foreground notification. Do not send routine success notifications.
- Notify only after a blocker persists or immediately when user action is required. Deep-link to the relevant account, source, or activity view.
- Implement native commands for retry failed, pause all, resume, scan now, and source enable or disable.

## Acceptance criteria

- The engine never runs two transfers concurrently.
- Transient errors return to retry-wait with increasing capped delay and later recover automatically.
- Authentication, certificate, quota, and permission failures become visible blockers with correct scope.
- Process death during direct or chunked transfer produces neither silent success nor a lost job.
- Long work runs with the Android-required foreground notification and survives the React Native activity closing.
- Constraint changes stop new files from starting and preserve the current job for safe continuation.
- Manual retry clears only eligible failure state and cannot duplicate a completed revision.
- All notification actions and deep links reach a valid screen after cold start.

## Verification

- Unit-test HTTP and exception classification, delay calculation, blocker scope, and worker continuation.
- Instrument network loss, HTTP 429, 401, 507, certificate failure, process death, notification denial, and cancellation.
- Confirm a queue drains oldest first and remains serial under competing triggers.

## Not in this ticket

- Parallel uploads
- Per-source constraints
- Battery-optimization exemption requests
- Routine completion notifications

## Open question

**Question:** How soon should a repeated server failure notify the user?

**Default:** Notify immediately for authentication, certificate, permission, and definite quota blockers. For retryable server failures, notify after three failed attempts or 24 hours, whichever comes first.
