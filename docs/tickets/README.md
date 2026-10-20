# Project tracking

Reconciled on 2026-09-28 against the implementation and Domi's current decisions. This is the current status index. [PLAN.md](../../PLAN.md) records product decisions; the [original tickets](../old-crap/tickets/README.md) retain historical requirements, including superseded UI designs.

## Current scope

Test locally on the emulator and connected phone, and fix observed upload failures. Adding a backup folder automatically includes existing eligible files. There is no include-existing choice or new-files-only mode. Release infrastructure is deferred.

## Implemented

These components exist in code. This list does not certify every original acceptance criterion or physical-device scenario.

| Area | Implementation evidence |
| --- | --- |
| Nextcloud account connection and persistence | [AccountManager.kt](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/AccountManager.kt) |
| Remote folder browsing and creation | [RemoteFolderManager.kt](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/RemoteFolderManager.kt), [picker](../../src/features/sources/RemoteFolderPicker.tsx) |
| Direct and chunked uploads | [NextcloudUploadClient.kt](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/NextcloudUploadClient.kt), [NextcloudChunkUploadClient.kt](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/NextcloudChunkUploadClient.kt) |
| Durable queue, discovery, background work | [Room database](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/EngineRoomDatabase.kt), [discovery](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/SourceDiscoveryManager.kt), [scheduler](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/EngineWorkScheduler.kt) |
| Backup setup, file inventory, settings | [UX implementation record](../../UX-PLAN.md), [source editor](../../src/features/sources/SourceEditor.tsx) |
| Cleanup and local diagnostics | [source removal](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/SourceRemovalCleanup.kt), [sign-out](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/SignOutCleanup.kt), [diagnostic log](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/DiagnosticEventLog.kt) |
| App-owned account acceptance harness | [acceptance runner](../../scripts/test/account-acceptance.mjs), replacing the library-host approach described in archived ticket 036 |
| Changed-file conflict controls and numbered filenames | [completed UX ticket](done/existing_files_ux.md) |
| Compact, accessible screens and parallel-device stress runner | [UX/stress work record](../UX-STRESS-PLAN.md) |

## Outstanding local validation

- Connected-phone check on 2026-09-28: MediaStore contains `20260928_161713.jpg` and `20260928_161719.jpg`, but the app database has one account, zero backup folders, zero discovered revisions, and zero upload jobs. The last scan completed at 16:17:52 local time. These photos were not queued by this app because Camera is not configured for backup. Configure the intended backup folder before verifying discovery and remote upload. No phone settings or app data were changed during inspection.
- Finish the remaining lifecycle scenarios and seven-day soak described in [014](../old-crap/tickets/014_verify_lifecycle_and_failure_recovery.md). The parallel-device run below covers large queues, process restart, interrupted networking, and background continuation, not the entire lifecycle matrix. The old dependency on completing ticket 013 is obsolete.
- The [UX/stress work record](../UX-STRESS-PLAN.md) records the completed UX pass and passing parallel-device acceptance: 2,000 verified uploads on each target, large-text/keyboard checks, no crash/ANR records, and successful cleanup.
- Per-backup queued/failed counts are now implemented. The original plan's typed user-facing string catalog remains unimplemented; it is not a requirement to introduce new copy or broaden this UX pass.

At the initial 2026-09-28 audit, typecheck, lint, and 67 JavaScript tests passed; native unit tests were up to date, and live acceptance was not rerun. Later that day, the full `pnpm check emu` suite passed, including 66 JavaScript tests, 82 native unit tests, Android instrumentation, and the parallel stress run. The JavaScript count changed when the unused transfer-rule summary and its test were removed. The main suite now clean-reinstalls this app on both targets, so it is unsuitable for inspecting existing phone backup state.

## Deferred

Release signing automation, tags, publication infrastructure, and store metadata are later work, per Domi. [015](../old-crap/tickets/015_prepare_the_github_prerelease.md) describes that future scope. Server compatibility claims and release acceptance remain prerequisites for publication, not blockers to local testing.
