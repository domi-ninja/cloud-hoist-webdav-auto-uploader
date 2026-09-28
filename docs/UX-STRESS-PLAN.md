# UX and device stress pass

Requested by Domi on 2026-09-28. Work autonomously through implementation and live verification.

## Scope

- Review Backups, Activity, Settings, account connection/settings, backup editor, permission recovery, and local/Nextcloud pickers.
- Keep compact Paper controls, existing approved wording, derived folder names, automatic inclusion of existing files, and icon actions. Preserve 48 dp touch targets, system text scaling, and light/dark contrast.
- Make loading, empty, error, saving, and disabled states actionable and consistent. Keep navigation and destructive confirmations usable with large text and the keyboard open.
- Bound mounted file rows and thumbnails, avoid unnecessary network work, and verify large libraries on the Samsung.
- Add a main-suite live stress runner: seed at least 2,000 identifiable photos per target before a clean app reinstall; run physical phone and emulator concurrently; degrade and interrupt emulator networking; check UI navigation, discovery, upload progress, process recovery, and crash/ANR evidence.
- Use isolated remote test destinations. Remove only fixtures belonging to the current run, restore emulator network/display settings, and retain concise reports/screenshots. Never print credentials.

## Progress

- [x] Initial code inventory and review of existing test infrastructure.
- [x] Implement coherent controls and accessibility fixes across all screens.
- [x] Fix large-library bottlenecks found by inspection and live tests.
- [x] Integrate parallel live stress checks with the main suite.
- [x] Run phone and degraded-network emulator tests and inspect screenshots.
- [x] Record results, limitations, and commits.

Initial findings: inconsistent account inputs; unvirtualized Activity rows; invisible preview loading; stale remote-folder state; duplicate account Save control; unhandled asynchronous failures and modal dismissal during saves; generic permission failure without a settings action. Device-test timeouts must tolerate the physical Samsung without hiding crashes or failed assertions.

## Screen inventory and implemented changes

| Area | UX changes |
| --- | --- |
| Backups | Explicit initial loading/retry, guarded scan/pause actions, per-folder pending/failed counts. Keep approved preset labels and edit immediately beside the toggle. |
| Activity | Virtualized, bounded rendering; cached thumbnails; collapsed filter icon; clear-filter action; grouped screen-reader row descriptions; bounded failure summaries. Remote queries stop when this tab is inactive. |
| Settings | Consistent root browser, accessible transfer switches, guarded asynchronous actions and diagnostic sharing. |
| Account setup | Labeled Paper fields, correct keyboard/autofill hints, retain entered credentials after a failed connection; browser-login polls no longer overlap. |
| Account settings | One toolbar save action, keyboard-aware scrolling, labeled fields, guarded dismissal, existing sign-out confirmation retained. |
| Backup editor | Immediate preset thumbnail preview, visible preview loading/retry, save readiness tied to successful preview, guarded save/dismissal/maintenance, compact controls with large-text scrolling. Keep parent/folder naming and destination rules. |
| Local/remote pickers | Real icons; dedicated Nextcloud browser modal with stable navigation, virtualized folder list, labeled new-folder input, loading/error/retry, stale-request protection. |
| Permission recovery | Explain remaining access problems and offer Android settings when permission cannot be requested again. |
| Shared controls/navigation | Paper inputs and icon buttons, 48 dp actions, busy/disabled/expanded states, heading semantics, complete green light/dark palette, scalable tab bar and safe-area handling. |

## Large-library and recovery fixes

- Move blocking inventory, remote-folder, thumbnail, and preview work off Expo's shared module queue.
- Keep a running upload visible even when more than 100 newer jobs exist.
- Share remote listings between pages briefly and remove the silent 2,000-file remote inventory cutoff.
- Continue successful bounded upload batches without treating each three-file batch as a failure/backoff.
- Keep future retries scheduled and recover claims from a dead process immediately.
- Live testing exposed Android rejecting foreground-service promotion on a background retry. Background batches now use ordinary bounded workers from the outset. If visibility changes during promotion, finish that worker and schedule a fresh ordinary batch: continuing inside the rejected worker leaves WorkManager's foreground bookkeeping inconsistent. Unrelated exceptions still surface.
- A remote audit after process recovery found abandoned hidden upload files. Direct uploads now reuse their durable job ID for staging across retries/restarts. Inventory hides in-flight staging objects; the live test independently rejects any unexpected remote objects after completion.
- Eight-minute worker time slices now continue immediately, including cancellation during an active transfer, without introducing network-failure backoff. Live logs showed both devices starting the next batch immediately after a successful slice.

## Test design and preliminary findings

`pnpm check emu` includes `pnpm test:stress`. Both targets get at least 2,000 unique, visibly labeled JPEGs generated from downloaded Picsum photographs before app uninstall. An isolated test-owned SAF tree includes only those fixtures, not personal photos. The test uses production discovery, queue, worker, and transfer code.

Checks cover first-launch validation, presets/thumbnails, filters/scrolling, remote browsing, account dialog with keyboard, 150% text, emulator dark mode, slow/interrupted emulator HTTPS, app process death, background completion, exact remote counts, three byte comparisons per device, and Android crash/ANR records. Each target has a two-hour upload deadline, configurable for larger runs.

The Android 16 emulator reached its normal on-battery job quota after roughly 20 minutes, with every remaining upload still queued. The runner now tests 25 minutes on battery followed by plugged-in recovery, retaining the slow network. It does not force jobs, change the app's standby bucket, or disable quotas. This reflects [Android's documented resource limits](https://developer.android.com/topic/performance/power/power-details); uninterrupted completion of a large initial backup on battery is not guaranteed. In diagnostic run `stress-mulfb21p-d4886b11`, a separately applied charging transition exposed the rejected-foreground-worker bookkeeping problem above. That run was stopped and cleaned up; it is not final acceptance evidence. Subsequent runs automate and restore the power transition.

Preliminary runs found and corrected harness problems with private sample storage, signed APK selection, persistent URI handoff, restarting the fixture provider during uploads, and Android retaining a parsed proxy after its setting was deleted. Those runs are not successful acceptance evidence. The interrupted populated-screen run exposed the real foreground-worker failure above; its emulator queue was deliberately cleaned up after diagnosis, not lost by the app.

Run `stress-mulh05hc-e2b8b126` exposed another harness interaction: calling the app's status provider every 20 seconds temporarily lifted Android's background-network block, causing WorkManager's in-process scheduler to start and cancel work repeatedly after quota exhaustion. The test-only build now writes atomic, transactionally consistent status snapshots; ADB reads those files without binding the app. The monitor restarts with the process but does not keep it foreground or acquire a wake lock. That diagnostic run was stopped and cleaned up, not counted as a pass.

Cleanup deletes only run-prefixed generated media and the isolated remote directory, removes the test backup configuration, restores display/proxy/power settings, and installs the normal release APK. Reports/screenshots stay in ignored `test-results/`; account display information may be visible in screenshots.

## Final acceptance, 2026-09-28

`pnpm check emu` exited successfully. Passing run: `stress-mulijqqs-4a813d56`.

| Target | Remote photos verified | Downloaded SHA-256 matches | Crash/ANR records | Cleanup errors | Total elapsed |
| --- | ---: | ---: | ---: | ---: | --- |
| Samsung SM-A166B, `RZCY31RD70Z` | 2,000 | 3 of 3 | 0 | 0 | 99m 50s |
| Android 16 emulator, `emulator-5554` | 2,000 | 3 of 3 | 0 | 0 | 92m 59s |

Elapsed time includes photo generation, clean installation, UI checks, transfers, verification, and cleanup. Both final queues had zero pending, running, retrying, or blocked jobs. Remote listings contained exactly the expected photos and no leftover staging objects.

The emulator transferred 65,166,136 bytes through the throttled TLS tunnel, including one intentional 15-second outage. It completed 25 minutes on battery, then continued after the automated charging transition without an app relaunch. Both devices survived the scripted process kill and cold start. Domi also paused the Samsung at 298 completed uploads; it resumed on request and completed the remaining queue. That additional pause/resume was manual, not part of the unattended script.

Navigation, camera/screenshots previews and derived destinations, populated Activity filters/scrolling, remote browsing, account editing with the keyboard visible, 150% text, and emulator dark mode passed. Screenshots were inspected during the UX pass. A Samsung background memory snapshot measured 115,102 KiB PSS; this was a point-in-time reading, not a peak-memory claim.

Other main-suite checks passed: typecheck, lint, 66 JavaScript tests, 82 native unit tests, 74 ordinary Android instrumentation tests, cold-start deep links, and release privacy checks. Eight live-only instrumentation cases were skipped by the ordinary runner; this stress phase runs its five fixture/UI methods explicitly on each device.

The generated media and isolated remote folders were deleted. Normal release builds were restored. The emulator's proxy, power, font, keyboard, and night settings were restored; both devices returned to their original font scale. Original photos were not removed or uploaded by the test backup. Screenshots and result JSON remain in ignored `test-results/stress-mulijqqs-4a813d56/`.

Implementation commits: `1071fb3` compact UX and large-library recovery; `4a53026` remove the redundant settings warning; `2ec5414` durable staging and time-slice continuation; `bf0623a` safe background-worker promotion. The accompanying test/docs commit adds the repeatable main-suite runner and this acceptance record.

This does not sign off a seven-day soak, prolonged Doze, every OEM power policy, all server configurations, or an uninterrupted initial backup entirely on battery. Release infrastructure remains deferred. The design pass kept Paper controls and existing icon conventions, with compact layouts and usable touch targets.
