# 074 Expose worker scan scope honestly

Status: done

Found while working on: 012

## Bug

Scheduler state stores `media` or `all` while a reconciliation worker runs, but
the bridge published that value as `worker.sourceId`. Source cards compared it
with UUIDs, so none could ever display the scanning state.

## Impact

Manual and background scans appeared idle even while Android was actively
walking configured sources.

## Fix

Model scanning activity with a typed `scope` discriminator across Kotlin,
TypeScript, fixtures, and UI. Mark all enabled sources as scanning for an `all`
scan and media-store sources for a `media` scan.

## Acceptance criteria

- Native snapshots expose `scope: media | all`, not a fake source ID.
- TypeScript rejects any other scan scope.
- Relevant source cards display `Scanning`.
- Bridge contract, lint, JavaScript tests, and Room view emulator tests pass.
