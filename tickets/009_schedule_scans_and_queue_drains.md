# 009 Schedule scans and queue drains

Status: blocked by 008

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

- Add WorkManager tests for unique-work policies, constraints, pause, resume, and repeated initialization.
- Use `adb` to inspect scheduled jobs before and after force-stop and reboot.
- Seed a missed file without firing the observer and confirm periodic reconciliation finds it.

## Not in this ticket

- Transfer retry classification
- Foreground-service notification
- OEM-specific battery exemption flows
- Exact schedules

## Open question

**Question:** Should periodic reconciliation use one worker for every source or one worker that scans all sources?

**Default:** Use one unique reconciliation worker that scans enabled sources sequentially. It simplifies global pause, avoids a large WorkManager graph, and can enqueue a continuation if its bounded run ends early.
