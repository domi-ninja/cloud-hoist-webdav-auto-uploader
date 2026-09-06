# 006 Add the durable Room queue

Status: complete

Depends on: 002, 005

## Outcome

Room persists accounts, source configuration, local file revisions, upload attempts, blockers, and chunk checkpoints. Queue state survives process death, reboot, and app upgrades.

## Work

- Define Room entities for non-secret account metadata, sources, upload jobs, attempts, and chunk-session checkpoints.
- Keep credentials in the encrypted store from ticket 003. Store only a credential reference in Room.
- Give every source and job stable generated IDs. Include `accountId` even though v0.1 exposes one account.
- Identify a local revision by source, provider identity or URI, relative path, size, and modification timestamp.
- Model the job lifecycle explicitly: queued, running, retry-wait, blocked, completed, and cancelled.
- Define blocker and last-error codes separately from human-readable display text.
- Add transactional operations to discover or update a revision, claim the next oldest eligible job, recover abandoned running work, record an attempt, block, retry, and complete.
- Ensure only one worker can claim a job. Treat process death during `running` as recoverable, not completed.
- Retain completed history for 30 days. Never expire unresolved jobs or failures automatically.
- Support deleting all records for one source and wiping the whole engine during confirmed sign-out.
- Export the Room schema and add migrations from the first committed schema onward.

## Acceptance criteria

- Queue state and source state survive process death and database reopen.
- Concurrent claims cannot return the same job.
- An abandoned running job returns to an eligible state without duplicating a completed revision.
- A moved or renamed source file creates a new job. A size or modification-time change creates a new revision.
- Completed local revisions do not requeue merely because the remote destination was deleted.
- Thirty-day cleanup removes only eligible completed history.
- Removing a source deletes its jobs and history in one transaction without touching device or remote files.
- Room migration and state-transition tests cover every state edge used by workers.

## Verification

- Run JVM tests for state transitions and Android Room tests for transactions, constraints, cleanup, and migration.
- Force-stop the app during a claimed fixture job and confirm recovery after restart.
- Inspect an exported schema to confirm no secret fields exist.

## Not in this ticket

- Source scanning
- WorkManager scheduling
- Chunk upload implementation
- UI pagination

## Open question

**Question:** May debug builds use destructive Room migrations before v0.1 ships?

**Default:** Yes, only in debug builds and only before the first public prerelease. Release builds always require explicit migrations.
