# F-Droid releases

[README](../README.md) · [Development](development.md) · [Architecture](architecture.md)

F-Droid is the only distribution target. Settings checks F-Droid for available versions; the app does not check GitHub for updates or download executable code. Google Play and EAS are not part of this workflow. GitHub hosts source, issues, and signed reference APKs for F-Droid verification.

## Version and source identity

Keep `app.json` as the release identity. For `2026-8`, set `expo.version` to `2026-8`, Android versionCode to `20260008`, and package.json version to `2026.8.0`. Retain package `ninja.domi.cloudhoist`. Increment the minor number for changed app bundles; start at 1 in a new year. Do not bump versions for documentation changes or upload retries.

## Build without signing credentials

Install dependencies with the pinned Node and pnpm versions, then:

```sh
nvm use
pnpm install --frozen-lockfile
pnpm fdroid:build
```

This generates the Android project and builds `dist/cloud-hoist-<version>-unsigned.apk`. It requires the SDK and JDK described in [Development](development.md), but does not require private signing files, an Expo account, or Google Play access. Expo telemetry and dotenv loading are disabled for this build.

The F-Droid recipe is `metadata/ninja.domi.cloudhoist.yml`. Its preparation must run from a clean checkout and provision only build tools, not an emulator or Play system image. Validate the fully prepared source, not just the tracked repository. The recipe keeps builds disabled and automatic build updates off until F-Droid build-server and maintainer review are complete.

## Local phone validation

Keep `.signing/release.p12` and `.signing/release.json`, and maintain an encrypted backup of both. Do not replace the existing key. F-Droid must never receive the private keystore or its passwords.

Sign the existing unsigned candidate and install it in place:

```sh
pnpm android:release
ANDROID_SERIAL=YOUR_PHONE_SERIAL pnpm android:install
```

Signing produces `dist/cloud-hoist-<version>.apk` without rebuilding. It checks 16 KB native-library alignment and preserves ZIP alignment so F-Droid can copy and verify the signature. Installation verifies the package, version, and existing certificate. Never uninstall the configured app or clear its data to bypass a signing mismatch. Follow [phone validation](development.md#phone-validation). For upload changes, verify downloaded hashes using test-owned files and folders.

`pnpm android:signing` exists only for a genuinely new signing identity and refuses to overwrite an existing signing directory. It is not a fix for missing release credentials on an existing project.

## Signed APKs for F-Droid verification

GitHub Releases hosts the signed APK that F-Droid compares with its own build. The recipe uses this versioned URL:

```text
https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/fdroid-reference-%v/cloud-hoist-%v.apk
```

For `2026-8`, the [verification release](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/tag/fdroid-reference-2026-8) contains the same signed APK tested on the phone and a `SHA256SUMS` file. Its tag points to tested source commit `01ea9e2d87f9d6928a917071b2df2a806e2bf24b`.

Publish reference APKs as prereleases with `--latest=false`, using tags named `fdroid-reference-<version>`. These tags sit outside F-Droid's normal `v<version>` discovery and the application CI's version-tag build trigger. Keep user setup and updates through F-Droid.

Before upload, verify the existing APK with `sh scripts/android/release.sh verify dist/cloud-hoist-<version>.apk`. Upload that file and its checksum. Do not rebuild, sign again, upload private signing files, or create an `update.json` feed. After publishing, download the APK without authentication, compare its SHA-256, and verify its signature against the independently rebuilt unsigned APK.

Treat a published reference APK and its version as fixed. Retry failed uploads with the existing file. App changes after publication get a new version.

## Checks and submission

Run type checking, lint, unit tests, native unit tests, release identity/attribution tests, license checks, F-Droid metadata lint, and source/APK scanning. The native build rejects runtime dependency coordinates that differ from the reviewed inventory. The APK gate also rejects unaccounted native libraries, stale embedded-code notices, and changed C++ runtime hashes. See the [attribution catalogue](../licenses/attribution-review.md) for each reviewed package and component.

To run the same F-Droid gates as CI, install fdroidserver 2.4.5 in a Python virtual environment, activate it, load the Android build environment, and use a clean committed checkout:

```sh
. scripts/android/env.sh
python scripts/fdroid/validate.py --gradle /path/to/trusted/gradle-9.3.1/bin/gradle
```

`gradlew-fdroid` is also accepted as the Gradle executable. The runner makes a separate Git checkout under ignored `test-results/`, enables only its local recipe copy, and runs `fdroid build --test` with source and APK scanners. It does not run privileged build-server provisioning on the workstation or publish anything. Output is copied to the normal unsigned candidate path.

The local validation runner builds an unsigned candidate and omits `Binaries` in its temporary recipe. A new candidate has no signed reference yet. The checked-in recipe retains `Binaries`; verify developer-signature reconstruction separately after local signing, then verify the public download.

Dependency updates require refreshing `dist/fdroid-native-dependencies.json`, reviewing the collected evidence under `licenses/`, and regenerating notices with `pnpm licenses:generate`. The inventory task writes its report before rejecting an unreviewed change; `scripts/fdroid/collect-licenses.py` can then collect published POMs and available artifact notices for review. Test a second build before claiming reproducibility. The native build normalizes source, Gradle-cache, and SDK paths, including filenames embedded in assertions and debug information. It also pins React Native's unused release dev-server IP to loopback instead of embedding the build machine's LAN address. Reanimated retains optimization but omits its path-dependent ThinLTO build ID. See the [readiness report](fdroid-readiness-report.md) for the distinction between a successful local build and a validated F-Droid build.

F-Droid can preserve our signing identity through its developer-signed reproducible-build workflow. The public reference URL is configured in `Binaries`, and local and independent CI builds match. F-Droid must still verify the recipe on its own infrastructure. If F-Droid instead signs with a new key, that APK cannot update existing installations normally.

Prepare listing metadata under `fastlane/metadata/android/en-US/`. Before submission, verify that screenshots show only test-owned content and that their license permits redistribution. Do not publish credentials, account identifiers, live backup paths, or signing files.

Pin each recipe build to the full tested source commit. Publish normal `v<version>` source tags when preparing accepted releases. Keep `AllowedAPKSigningKeys` bound to the existing public certificate and `Binaries` pointed at the matching verification release. Remove the candidate disable flag after F-Droid build-server and maintainer review. Enable `AutoUpdateMode: Version v%v` after initial acceptance. Version discovery reads versionName and versionCode from tagged `app.json` files.

Domi submits the prepared recipe to F-Droid. Agents must not contact maintainers, create inclusion issues, or file pull or merge requests without a later explicit instruction. Main-repository review, any maturity exception, and publication are external gates; do not label the app as listed before acceptance.

## CI

The Android workflow runs checks and builds unsigned F-Droid candidates through the F-Droid validator. Markdown-only main pushes skip APK builds. It has no publishing credentials, does not create GitHub APK releases, and does not submit to other stores. Artifact retention supports validation rather than a separate distribution channel.
