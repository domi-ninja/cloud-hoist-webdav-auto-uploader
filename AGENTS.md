# Repo-specific guidelines

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## UI controls

- Do not make buttons full-phone-width by default.
- Prefer an icon placed next to the item it acts on, or a compact button group whose actions belong together.
- Use a full-width button only when the action genuinely needs that visual priority and cannot be placed more coherently.

## Physical-device validation

- Test affected Android app flows on the connected physical phone before calling app changes complete. Emulator checks alone do not satisfy this requirement.
- Select the phone explicitly. Use signed, in-place updates and test-owned folders and files. Preserve existing accounts, backup settings, queues, history, photos, and server files; do not run data-clearing harnesses against the user's live app.
- Inspect the affected screens on the phone and exercise the changed controls. For upload changes, verify actual uploads against downloaded file hashes. Report the device, build, results, and anything that could not be tested.

## Versions and releases

- Use `$year-$minorversion` for the public app version, starting with `2026-1`. Increment the minor number for each changed release bundle. Start at 1 in a new year.
- Keep `app.json` as the release identity. Android versionCode is year × 10000 + minor. The package.json tooling version uses year.minor.0.
- Build, test, install, and publish the same signed APK for a version. Do not publish another version of the same patch just because a CI run or push happened.
- Rebuild a version only for a concrete reason such as a failed build or failed test. Fixes after publication get a new version. Retry failed uploads with the existing artifact.
- Ordinary main pushes do not release. Release tags and manual Actions runs skip versions already published. When a local APK was tested on the phone, publish that artifact before pushing its version tag.
