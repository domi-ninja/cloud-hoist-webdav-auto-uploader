# F-Droid releases

[README](../README.md) · [Development](development.md) · [Architecture](architecture.md)

F-Droid is the only distribution target. The app does not check GitHub for updates or download executable code. Google Play and EAS are not part of this workflow. GitHub is a source mirror and issue tracker.

## Version and source identity

Keep `app.json` as the release identity. For `2026-7`, set `expo.version` to `2026-7`, Android versionCode to `20260007`, and package.json version to `2026.7.0`. Retain package `ninja.domi.cloudhoist`. Increment the minor number for changed app bundles; start at 1 in a new year. Do not bump versions for documentation changes or upload retries.

## Build without signing credentials

Install dependencies with the pinned Node and pnpm versions, then:

```sh
nvm use
pnpm install --frozen-lockfile
pnpm fdroid:build
```

This generates the Android project and builds `dist/cloud-hoist-<version>-unsigned.apk`. It requires the SDK and JDK described in [Development](development.md), but does not require private signing files, an Expo account, or Google Play access. Expo telemetry and dotenv loading are disabled for this build.

The F-Droid recipe is `metadata/ninja.domi.cloudhoist.yml`. Its preparation must run from a clean checkout and provision only build tools, not an emulator or Play system image. Validate the fully prepared source, not just the tracked repository. The recipe keeps builds disabled and automatic build updates off until signing and build-server validation are settled.

## Local phone validation

Keep `.signing/release.p12` and `.signing/release.json`, and maintain an encrypted backup of both. Do not replace the existing key. F-Droid must never receive the private keystore or its passwords.

Sign the existing unsigned candidate and install it in place:

```sh
pnpm android:release
ANDROID_SERIAL=YOUR_PHONE_SERIAL pnpm android:install
```

Signing produces `dist/cloud-hoist-<version>.apk` without rebuilding. Installation verifies the package, version, and existing certificate. Never uninstall the configured app or clear its data to bypass a signing mismatch. Follow [phone validation](development.md#phone-validation). For upload changes, verify downloaded hashes using test-owned files and folders.

`pnpm android:signing` exists only for a genuinely new signing identity and refuses to overwrite an existing signing directory. It is not a fix for missing release credentials on an existing project.

## Checks and submission

Run type checking, lint, unit tests, native unit tests, release identity tests, license checks, F-Droid metadata lint, and source/APK scanning. Test a second build before claiming reproducibility. The native build normalizes source, Gradle-cache, and SDK paths, including filenames embedded in assertions and debug information. See the root readiness report for the distinction between a successful local build and a validated F-Droid build.

F-Droid can preserve our signing identity only through a verified developer-signed reproducible-build workflow. Its public reference-artifact requirement must be resolved before promising migration of existing installations. If F-Droid instead signs with a new key, that APK cannot update existing installations normally.

Prepare listing metadata under `fastlane/metadata/android/en-US/`. Before submission, verify that screenshots show only test-owned content and that their license permits redistribution. Do not publish credentials, account identifiers, live backup paths, or signing files.

The source tag must match the version in `app.json`. Once validation is complete, create that tag at the tested commit. F-Droid's recipe follows version tags and reads versionName and versionCode from `app.json`.

Domi submits the prepared recipe to F-Droid. Agents must not contact maintainers, create inclusion issues, or file pull or merge requests without a later explicit instruction. Main-repository review, any maturity exception, and publication are external gates; do not label the app as listed before acceptance.

## CI

The Android workflow runs checks and builds unsigned F-Droid candidates. It has no publishing credentials, does not create GitHub APK releases, and does not submit to other stores. Artifact retention supports validation rather than a separate distribution channel.
