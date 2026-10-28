# Beta and F-Droid releases

[README](../README.md) · [Development](development.md) · [Architecture](architecture.md)

Beta users install signed APKs from GitHub Releases. F-Droid is the production target and is not listed yet. Google Play and EAS OTA are excluded. Builds default to beta unless `CLOUD_HOIST_CHANNEL=fdroid` is explicitly selected. Keep the existing package and signing identity in both channels.

## Current beta

[2026-12 beta](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/tag/beta-2026-12) fixes breadcrumb spacing in the remote folder browser. The path is inset from the screen edge, and every slash and folder label has the same compact gap. APK SHA-256 is `a8de8040951e76e4c12f10195bb0569e914eb44307aa94ec2cb8c8a004b26f18`.

Validation uses a signed in-place update on the Pixel 9-sized Android 16 emulator, as requested for this fix. Checks cover nested paths, short folder names, wrapped names, ancestor navigation, the parent button, and the server root. No physical-phone validation was performed for this release. Evidence is under ignored `test-results/breadcrumbs-2026-12/`.

Type checking, lint, 122 JavaScript tests, release checks, and APK privacy/attribution checks pass. This release changes breadcrumb layout only; it does not claim new upload-engine or F-Droid reproducibility validation.

## Default delivery flow

A feature or app-fix request includes a beta release unless Domi explicitly says to hold it. Complete implementation, checks, signed in-place phone validation, and GitHub publication in the same task. Return the verified direct APK download link. A local APK path, source push, or successful phone install does not finish delivery.

| Build | Distribution | In-app update source | Selection |
| --- | --- | --- | --- |
| Beta | Signed APK in a GitHub prerelease | GitHub beta releases | Default; `pnpm android:build` |
| Production | F-Droid, after acceptance | F-Droid only | Explicit; `pnpm fdroid:build` |

The channel is embedded at build time. Beta never falls back to F-Droid; production never offers GitHub betas. Publish production only as a separate release decision after its F-Droid checks and acceptance. F-Droid review does not block beta delivery. Documentation-only changes need a commit, not an APK.

## Version and source identity

Keep `app.json` as the release identity. Choose a version newer than the current beta. For example, the next version after `2026-12` is `2026-13`: set `expo.version` to `2026-13`, Android versionCode to `20260013`, and package.json version to `2026.13.0`. Retain package `ninja.domi.cloudhoist`. Increment the minor number for changed app bundles; start at 1 in a new year. Do not bump versions for documentation changes or upload retries.

## Build without signing credentials

Install dependencies with the pinned Node and pnpm versions, then:

```sh
nvm use
pnpm install --frozen-lockfile
pnpm android:build       # beta, the default app channel
pnpm fdroid:build        # explicitly selects fdroid
```

Both commands generate the Android project. Beta output is `dist/cloud-hoist-<version>-unsigned.apk`; F-Droid output is `dist/fdroid/cloud-hoist-<version>-unsigned.apk`. It requires the SDK and JDK described in [Development](development.md), but does not require private signing files, an Expo account, or Google Play access. Expo telemetry and dotenv loading are disabled for this build.

The F-Droid recipe is `metadata/ninja.domi.cloudhoist.yml`. Its preparation must run from a clean checkout and provision only build tools, not an emulator or Play system image. Validate the fully prepared source, not just the tracked repository. The recipe keeps builds disabled and automatic build updates off until F-Droid build-server and maintainer review are complete.

## Local phone validation

Keep `.signing/release.p12` and `.signing/release.json`, and maintain an encrypted backup of both. Do not replace the existing key. F-Droid must never receive the private keystore or its passwords.

Sign the existing unsigned candidate and install it in place:

```sh
pnpm android:release
ANDROID_SERIAL=YOUR_PHONE_SERIAL pnpm android:install
```

Signing produces `dist/cloud-hoist-<version>.apk` without rebuilding. To sign a F-Droid reference candidate instead, run `CLOUD_HOIST_CHANNEL=fdroid pnpm android:release`; its signed APK stays in `dist/fdroid/`. It checks 16 KB native-library alignment and preserves ZIP alignment so F-Droid can copy and verify the signature. Installation verifies the package, version, and existing certificate. Never uninstall the configured app or clear its data to bypass a signing mismatch. Follow [phone validation](development.md#phone-validation). For upload changes, verify downloaded hashes using test-owned files and folders.

`pnpm android:signing` exists only for a genuinely new signing identity and refuses to overwrite an existing signing directory. It is not a fix for missing release credentials on an existing project.

## Beta publication

After checks and signed in-place phone validation, publish the existing beta APK and `SHA256SUMS` in a GitHub prerelease tagged `beta-<version>`, with `--latest=false`. The asset must be named `cloud-hoist-<version>.apk` and finish uploading before it can be offered. The app reads published releases, including prereleases, rather than GitHub's stable-only latest endpoint. It ignores F-Droid reference releases and compares numeric year-minor versions. No token or custom update feed is needed.

Settings checks automatically when opened, reports failures, and offers **Download update** for a newer version. This opens the APK in the browser; Android completes the in-place installation. Existing `2026-9` installations contain the former F-Droid-only check and need one manual beta APK installation to gain this behavior.

Feature and app-fix requests authorize this publication unless Domi has put the release on hold. Use this sequence:

1. Commit the tested source and push it. Tag that revision as `beta-<version>`.
2. Verify the existing signed beta APK with `sh scripts/android/release.sh verify dist/cloud-hoist-<version>.apk`. Create `SHA256SUMS` for that exact file.
3. Upload the APK and checksum to a GitHub prerelease with `--latest=false`. Do not upload the F-Droid binary to this release.
4. Download the public APK without authentication and compare its SHA-256 with the tested file. Confirm the public releases API exposes the uploaded APK under the expected tag and URL.
5. Return the direct link `https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/beta-<version>/cloud-hoist-<version>.apk`. If a QR is requested, encode that URL and decode the generated QR to verify it.

Once a beta APK is public, its bytes and version are fixed. Build changes get the next version, and upload retries reuse the existing APK. A failed check or upload is an unfinished release; report the specific blocker instead of calling a local build delivered.

## Signed APKs for F-Droid verification

GitHub Releases hosts the signed APK that F-Droid compares with its own build. The recipe uses this versioned URL:

```text
https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/fdroid-reference-%v/cloud-hoist-%v.apk
```

For `2026-8`, the [verification release](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/tag/fdroid-reference-2026-8) contains the same signed APK tested on the phone and a `SHA256SUMS` file. Its tag points to tested source commit `01ea9e2d87f9d6928a917071b2df2a806e2bf24b`.

Publish reference APKs as prereleases with `--latest=false`, using tags named `fdroid-reference-<version>`. These tags sit outside F-Droid's normal `v<version>` discovery and the application CI's version-tag build trigger. Only F-Droid-channel APKs belong in these reference releases. Beta users receive the separately built beta APK.

Before upload, verify the existing APK with `CLOUD_HOIST_CHANNEL=fdroid sh scripts/android/release.sh verify dist/fdroid/cloud-hoist-<version>.apk`. Upload that file and its checksum. Do not rebuild, sign again, upload private signing files, or create an `update.json` feed. After publishing, download the APK without authentication, compare its SHA-256, and verify its signature against the independently rebuilt unsigned APK.

Treat a published reference APK and its version as fixed. Retry failed uploads with the existing file. App changes after publication get a new version.

## Checks and submission

Run type checking, lint, unit tests, native unit tests, release identity/attribution tests, license checks, F-Droid metadata lint, and source/APK scanning. The native build rejects runtime dependency coordinates that differ from the reviewed inventory. The APK gate also rejects unaccounted native libraries, stale embedded-code notices, and changed C++ runtime hashes. See the [attribution catalogue](../licenses/attribution-review.md) for each reviewed package and component.

To run the optional F-Droid checks locally, install fdroidserver 2.4.5 in a Python virtual environment, activate it, load the Android build environment, and use a clean committed checkout:

```sh
. scripts/android/env.sh
python scripts/fdroid/validate.py --gradle /path/to/trusted/gradle-9.3.1/bin/gradle
```

`gradlew-fdroid` is also accepted as the Gradle executable. The runner makes a separate Git checkout under ignored `test-results/`, enables only its local recipe copy, and runs `fdroid build --test` with source and APK scanners. It does not run privileged build-server provisioning on the workstation or publish anything. Output is copied to `dist/fdroid/cloud-hoist-<version>-unsigned.apk`.

The local validation runner builds an unsigned candidate and omits `Binaries` in its temporary recipe. A new candidate has no signed reference yet. The checked-in recipe retains `Binaries`; verify developer-signature reconstruction separately after local signing, then verify the public download.

Dependency updates require refreshing `dist/fdroid-native-dependencies.json`, reviewing the collected evidence under `licenses/`, and regenerating notices with `pnpm licenses:generate`. The inventory task writes its report before rejecting an unreviewed change; `scripts/fdroid/collect-licenses.py` can then collect published POMs and available artifact notices for review. Test a second build before claiming reproducibility. The native build normalizes source, Gradle-cache, and SDK paths, including filenames embedded in assertions and debug information. It also pins React Native's unused release dev-server IP to loopback instead of embedding the build machine's LAN address. Reanimated retains optimization but omits its path-dependent ThinLTO build ID. See the [readiness report](fdroid-readiness-report.md) for the distinction between a successful local build and a validated F-Droid build.

F-Droid can preserve our signing identity through its developer-signed reproducible-build workflow. The public reference URL is configured in `Binaries`. Local and independent CI builds matched for `2026-7` and `2026-9`; the `2026-10` F-Droid independent CI comparison and developer-signature reconstruction remain pending. F-Droid must still verify the recipe on its own infrastructure. If F-Droid instead signs with a new key, that APK cannot update existing installations normally.

Prepare listing metadata under `fastlane/metadata/android/en-US/`. Before submission, verify that screenshots show only test-owned content and that their license permits redistribution. Do not publish credentials, account identifiers, live backup paths, or signing files.

Pin each recipe build to the full tested source commit. Publish normal `v<version>` source tags when preparing accepted releases. Keep `AllowedAPKSigningKeys` bound to the existing public certificate and `Binaries` pointed at the matching verification release. Remove the candidate disable flag after F-Droid build-server and maintainer review. Enable `AutoUpdateMode: Version v%v` after initial acceptance. Version discovery reads versionName and versionCode from tagged `app.json` files.

Domi submits the prepared recipe to F-Droid. Agents must not contact maintainers, create inclusion issues, or file pull or merge requests without a later explicit instruction. Main-repository review, any maturity exception, and publication are external gates; do not label the app as listed before acceptance.

## CI

The **Android checks** workflow runs tests and builds an unsigned beta APK on main pushes and version tags. Markdown-only main pushes skip the workflow. It retains the APK for 14 days, has no publishing credentials, and does not create releases or submit to stores.

F-Droid validation is manual for now. In GitHub Actions, select **Android checks**, choose **Run workflow**, and enable `fdroid` to run the F-Droid validator instead of the beta build. First update the candidate recipe to match `app.json`; the validator rejects mismatched versions. The pinned F-Droid recipe does not block ordinary beta CI.
