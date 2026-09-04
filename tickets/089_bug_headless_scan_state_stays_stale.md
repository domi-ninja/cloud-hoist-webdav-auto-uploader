# 089 Bug: headless scan state stays stale

Status: in progress

Depends on: 010, 012, 088

## Observed

After a global scan discovered and uploaded files from several watch folders, the open Sources screen continued showing Scanning. The Room database already contained the new revisions and completed jobs. Force-stopping and reopening the app immediately showed the correct completed state.

## Cause

Foreground engine commands emit `onSnapshotInvalidated` through the live Expo module. Headless WorkManager workers update Room and `EnginePreferences` directly and have no live module instance through which to emit that event. The foreground React Query cache therefore sees scan start but not scan completion or queue progress.

## Fix

- Poll the local engine snapshot while a connected account is visible in the foreground.
- Poll quickly while a scan or upload is active and less often while idle so headless work is still discovered.
- Do not poll before an account is connected.
- Rely on React Query's default foreground behavior so the interval does not become a background timer.

## Acceptance criteria

- Scan now transitions from Scanning to the final queue state without reopening the app.
- Upload progress and completion produced by WorkManager become visible on the open Sources screen.
- A connected but idle screen eventually notices work started by a headless observer.
- Signed-out screens do not poll the native snapshot repeatedly.

## Verification

- Add focused tests for the snapshot polling interval policy.
- Run TypeScript, Expo lint, and Jest.
- Build and install the release APK.
- Trigger a real emulator scan and confirm the open UI settles without an app restart.

