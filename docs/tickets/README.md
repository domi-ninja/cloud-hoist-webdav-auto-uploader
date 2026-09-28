# Project tracking

Reconciled on 2026-09-28 against the implementation and Domi's current decisions. This is the current status index. [PLAN.md](../../PLAN.md) records product decisions; the [original tickets](../old-crap/tickets/README.md) retain historical requirements, including superseded UI designs.

## Current scope

Test locally on the emulator and connected phone, and fix observed upload failures. Adding a backup folder automatically includes existing eligible files. There is no include-existing choice or new-files-only mode. Release infrastructure is deferred.

## Implemented

These components exist in code. This list does not certify every original acceptance criterion or physical-device scenario.

| Area | Implementation evidence |
| --- | --- |
| Nextcloud account connection and persistence | [AccountManager.kt](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/AccountManager.kt) |
| Remote folder browsing and creation | [RemoteFolderManager.kt](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/RemoteFolderManager.kt), [picker](../../src/features/sources/RemoteFolderPicker.tsx) |
| Direct and chunked uploads | [NextcloudUploadClient.kt](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/NextcloudUploadClient.kt), [NextcloudChunkUploadClient.kt](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/NextcloudChunkUploadClient.kt) |
| Durable queue, discovery, background work | [Room database](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/EngineRoomDatabase.kt), [discovery](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/SourceDiscoveryManager.kt), [scheduler](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/EngineWorkScheduler.kt) |
| Backup setup, file inventory, settings | [UX implementation record](../../UX-PLAN.md), [source editor](../../src/features/sources/SourceEditor.tsx) |
| Cleanup and local diagnostics | [source removal](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/SourceRemovalCleanup.kt), [sign-out](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/SignOutCleanup.kt), [diagnostic log](../../modules/webdav-upload-engine/android/src/main/java/ninja/domi/webdavautoupload/engine/DiagnosticEventLog.kt) |
| App-owned account acceptance harness | [acceptance runner](../../scripts/test/account-acceptance.mjs), replacing the library-host approach described in archived ticket 036 |
| Changed-file conflict controls and numbered filenames | [completed UX ticket](done/existing_files_ux.md) |

## Outstanding local validation

- Connected-phone check on 2026-09-28: MediaStore contains `20260928_161713.jpg` and `20260928_161719.jpg`, but the app database has one account, zero backup folders, zero discovered revisions, and zero upload jobs. The last scan completed at 16:17:52 local time. These photos were not queued by this app because Camera is not configured for backup. Configure the intended backup folder before verifying discovery and remote upload. No phone settings or app data were changed during inspection.
- Run the physical-device lifecycle and recovery scenarios described in [014](../old-crap/tickets/014_verify_lifecycle_and_failure_recovery.md). The implementation exists, but device validation and the seven-day soak have not been signed off. The old dependency on completing ticket 013 is obsolete.
- Finish the [UX review](../../UX-PLAN.md) for populated queues, long paths, large system text, accessibility, and recovery states.
- Reconcile remaining original-plan requirements before calling the plan fully implemented: per-backup queued/failed counts and the typed user-facing string catalog are not implemented. These are documented gaps, not instructions to expand the current local-testing task.

On 2026-09-28, typecheck, lint, and all 67 JavaScript tests passed. The native unit command succeeded with Gradle's test task up to date. The full device/live acceptance suite was not rerun during that audit. The live acceptance command clears the selected app's data, so it is unsuitable for inspecting the current phone's uploads.

## Deferred

Release signing automation, tags, publication infrastructure, and store metadata are later work, per Domi. [015](../old-crap/tickets/015_prepare_the_github_prerelease.md) describes that future scope. Server compatibility claims and release acceptance remain prerequisites for publication, not blockers to local testing.
