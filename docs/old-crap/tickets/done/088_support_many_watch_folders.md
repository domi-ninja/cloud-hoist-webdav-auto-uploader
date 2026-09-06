# 088 Support many watch folders

Status: done

Depends on: 011, 012, 083, 087

## Outcome

Users can keep adding independently watched Android folders without an app-defined source limit. The Sources screen remains usable as that list grows.

## Work

- Make Add watch folder a first-class action instead of hiding folder watching behind the generic source picker.
- Keep Camera and Screenshots presets available as a separate media-source action.
- After saving a source, offer to add another watch folder without leaving setup.
- Continue defaulting every new source to `/WebDAV Auto Upload` unless the user changes it.
- Keep every source independently named, enabled, scanned, retargeted, and removable.
- Virtualize the source ledger so the app does not mount every source card at once.
- Preserve pull-to-scan, the global controls, setup cancellation, and enlarged-font scrolling.
- Add a persistence test proving a large number of distinct source rows can coexist without replacement or truncation.

## Acceptance criteria

- An account with no sources can still choose Camera, Screenshots, or an Android folder.
- Once setup is complete, Add watch folder opens a folder-focused setup flow.
- Add Camera or Screenshots remains available separately.
- A successful save offers Add another watch folder and Done.
- Repeating Add another watch folder creates a new independent source each time.
- The app imposes no numeric source cap or local-folder uniqueness rule.
- A long source list scrolls through a virtualized native list.
- Each new source defaults to `/WebDAV Auto Upload`.
- Existing source controls and global scan/pause controls still work.

## Verification

- Add an Android database test that stores many sources and asserts every row is returned in order.
- Run TypeScript, Expo lint, Jest, and native Android tests.
- Build and install the release APK on the API 36 emulator.
- Create several distinct local folders on the emulator and add them in one repeated setup session.
- Put different image files into the watched folders, scan, and verify the uploads reach the configured Nextcloud destination.
- Remove only the temporary acceptance sources after verification.

## Constraint

The app will not set its own limit. Android, the device, and persisted Storage Access Framework grants remain finite platform resources.

## Verified

- The Android database suite stored and returned 256 independent SAF sources.
- A release build added WatchAlpha, WatchBeta, and WatchGamma in one repeated setup session.
- Each folder discovered and uploaded a distinct image to `/WebDAV Auto Upload`.
- All uploaded fixtures were byte-identical when fetched back from Nextcloud.
- The remote fixtures, temporary sources, and emulator folders were removed after the run.
