# 009 Schedule scans and queue drains

Status: complete

Depends on: 006, 008

## Outcome

WorkManager wakes the engine for MediaStore changes and periodic reconciliation, drains eligible queued work, and preserves scheduling across process death, reboot, and app updates.

## Work

- Register one-shot MediaStore scan work with content URI triggers for image, video, and relevant external content changes.
- Debounce bursts of media changes so taking several photos does not create competing scans.
- Register unique periodic reconciliation work at Android's 15-minute minimum for all enabled sources.
- Reconcile MediaStore and SAF sources during periodic work. Do not claim it will execute at an exact clock time.
- Enqueue one unique global queue-drain worker after scans add jobs and when paused or blocked work becomes eligible.
- Add network, battery-not-low, and optional charging constraints from global settings.
- Map the unmetered-only setting to WorkManager network constraints. Let users opt into any connected network.
- Ensure repeated app starts and scheduler repairs do not duplicate periodic work or queue drains.
- Let WorkManager restore persistent scheduling after reboot. Add custom boot handling only if device tests prove WorkManager fails to restore required registrations.
- Bound each scan and worker run. Persist queue state before yielding so later work continues safely.
- Expose last requested scan, last completed scan, current worker state, and active constraints to the module snapshot.

## Acceptance criteria

- A new MediaStore item requests a scan without the app activity running.
- Periodic work finds files missed by content triggers and scans SAF sources.
- Process death, reboot, app update, and repeated scheduler initialization do not lose or duplicate scheduled work.
- Pause cancels or prevents new queue drains without deleting jobs. Resume schedules eligible work.
- Changing global constraints replaces the relevant unique work safely.
- Two simultaneous triggers still produce one logical scan or queue drain.
- The UI can distinguish last scan completion from an untrustworthy predicted next-run time.

## Verification

- WorkManager instrumentation tests cover unique policies, the 15-minute periodic interval, transfer constraints, pause persistence, cancellation, and repeated initialization.
- Scan-runner tests prove media events scan only MediaStore sources, reconciliation includes SAF sources, and bounded runs request a drain before yielding.
- The full API 36 instrumentation suite passes 35 tests with the two credential-gated live tests skipped.
- With the activity closed and app process killed, inserting a MediaStore image woke `MediaObserverWorker`. WorkManager completed the scan and rearmed the observer.
- `dumpsys jobscheduler` showed one periodic `ReconciliationWorker` and one `MediaObserverWorker` after an APK update.
- A full emulator reboot restored the same two jobs before app launch. Launching the app did not duplicate either job.

## Not in this ticket

- Transfer retry classification
- Foreground-service notification
- OEM-specific battery exemption flows
- Exact schedules

## Open question

**Question:** Should periodic reconciliation use one worker for every source or one worker that scans all sources?

**Default:** Use one unique reconciliation worker that scans enabled sources sequentially. It simplifies global pause, avoids a large WorkManager graph, and can enqueue a continuation if its bounded run ends early.
