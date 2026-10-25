# Repo-specific guidelines

## Expo SDK

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
- Feature and app-fix requests include shipping a tested GitHub beta and returning its direct APK download link, unless Domi explicitly says to hold the release. Do not stop at a commit, local build, or phone install, and do not ask for publication permission again. Documentation-only work does not create a release.
- Builds default to beta. Beta users install signed APKs from GitHub Releases, and Settings checks GitHub including beta prereleases. Explicitly set `CLOUD_HOIST_CHANNEL=fdroid` for F-Droid builds, which check and link only to F-Droid. Do not add Google Play or EAS OTA. Preserve the package and signing identity across both channels.
- Build unsigned candidates without private signing credentials. Sign the same artifact with the existing key for physical-phone validation and the matching F-Droid reference upload.
- Preserve the existing package and signing identity. Do not uninstall or clear existing app data to bypass a signature mismatch.
- Rebuild a version only for a concrete build or test failure. Once distributed, app fixes get a new version. Retry failed uploads with the existing artifact.
- Ordinary source pushes run checks and retain unsigned validation artifacts. They do not publish APKs or contact F-Droid.
- Do not contact people, create external issues, or file pull/merge requests on Domi's behalf. Prepare a local handoff and report external submission or approval gates.

## Documentation

- Keep user setup in README.md, development and testing in docs/development.md, engine behavior in docs/architecture.md, and releases in docs/publishing.md.
- Update those guides instead of adding plans, audit logs, completed-ticket archives, or per-fix reports. Git history retains previous decisions.
- Documentation-only changes do not bump app versions or build APKs.
