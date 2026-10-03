# WebDAV Auto Upload

WebDAV Auto Upload is an Android app for automatic uploads to Nextcloud servers. It is an independent project and is not affiliated with or endorsed by Nextcloud GmbH.

The app is being tested locally on Android phones and emulators. Signed APKs can be built for a private beta; store publishing is deferred. Product decisions live in [PLAN.md](PLAN.md), and [project tracking](docs/tickets/README.md) records implemented work, outstanding validation, and archived tickets.

## Private beta signing

Run `pnpm android:signing` once to create the private release key. It refuses to
overwrite an existing `.signing/` directory. Back up the entire directory securely
in a password manager or encrypted offline storage. It contains both the keystore
and its password, is owner-only, and is ignored by Git. Losing it prevents signing
compatible updates. Never share it with testers.

Run `pnpm android:beta` to generate the Android project, build and verify the signed
APK, and copy it to `dist/webdav-auto-upload-beta.apk`. Share only that APK.
The command never installs or uninstalls anything on connected devices.
Before each subsequent distributed build, increase `expo.android.versionCode`
in `app.json`; update `expo.version` there for a new visible version.

Only this beta command applies the private signing configuration. Ordinary local
Gradle/test builds retain the debug key so device tests remain compatible. Do not
distribute their APKs. A beta cannot update an existing debug-signed installation;
switching requires uninstalling it first, which removes app settings and history.
Future beta updates use the same private key and can install over the previous beta.

## Publish a beta

Run `pnpm android:publish` to build locally, sign with the existing key, and upload
to Nextcloud. No GitHub, CI service, or phone connection is involved.

One-time setup:

1. Complete the development setup below and ensure `.signing/release.json` and
   `.signing/release.p12` exist. On this machine the signing key already exists;
   do not regenerate it. Keep an encrypted backup.
2. Choose a dedicated beta folder in Nextcloud. The script creates it if missing;
   its parent must already exist. Give testers a read-only,
   password-protected folder share. The script does not create or change shares.
3. Set these variables in the repository's `.env`. Use the actual URL-encoded
   WebDAV account root, not the tester share link. Use a dedicated
   Nextcloud app password, preferably for an account limited to this folder.

```dotenv
NEXTCLOUD_WEBDAV_URL="https://cloud.domi.ninja/remote.php/dav/files/prime"
NEXTCLOUD_USERNAME="prime"
NEXTCLOUD_PASSWORD="YOUR-NEXTCLOUD-APP-PASSWORD"
NEXTCLOUD_DIRECTORY="beta_apps"
```

Protect that file with `chmod 600 .env`. Both `.env` and the `.signing/`
directory are ignored by Git. Never send these credentials or the signing key to testers.
Existing shell environment variables take precedence over `.env`. Directory names
are encoded automatically; use normal folder names in `NEXTCLOUD_DIRECTORY`.

Each `pnpm android:publish` run checks the destination, increments
`expo.android.versionCode` in `app.json`, builds and verifies the APK signature,
uploads a unique temporary file, downloads it to verify SHA-256, and renames it to
`webdav-auto-upload-<versionCode>.apk` without replacing an existing beta.
Keep and commit the version bump, even after a failed build/upload. Use this one
checkout for publishing, or synchronize `app.json` before publishing elsewhere.
Update `expo.version` manually when you want a new user-visible version label.

The local APK remains at `dist/webdav-auto-upload-beta.apk`. On failure the command
exits nonzero and attempts to remove only its own temporary upload. It never deletes
previous betas. Refused connections are retried up to three times with short backoff;
other failures stop the command. Nextcloud reserves `.part`, so staging uses a unique
`.beta-<UUID>.apk` filename.
A lost response to the final rename may mean publication succeeded;
check the remote folder before retrying. Old versions remain for manual cleanup.
If the process is killed, check that no build is still running before removing the
empty `dist/.beta-build-lock` directory with `rmdir dist/.beta-build-lock`.

Testers open the shared folder, download the highest-numbered APK, and approve the
Android update. This publishes downloads; it does not silently install or send
push notifications. `pnpm android:beta` still builds locally without uploading or
incrementing the version. `pnpm test:publish` tests the upload protocol with a fake
server, without touching Nextcloud.

## Development requirements

- Linux on x86-64 with KVM available
- Git
- nvm

The tested Android CLI version is `1.0.16261425`. Its built-in help accepts the emulator profile as a positional argument even though an earlier documentation example used `--profile`.

## First setup

```sh
./scripts/setup.sh
```

The setup script selects Node.js 24.20.0 through nvm, activates pnpm 11.3.0, installs project dependencies, installs Google's Android CLI when needed, installs the pinned JDK and Android SDK components, and creates the `medium_phone` API 36 emulator. Build Tools 35 and CMake are explicit React Native transitive requirements.

The project also pins Node.js 24.20.0 through pnpm's `devEngines.runtime`. After `pnpm install`, project scripts and `pnpm exec node` use that runtime even when the shell defaults to another Node version. Use `nvm use` for direct `node` commands.

## Run on Android

```sh
nvm use
pnpm android
```

The command resolves Google's user-local SDK, generates the Android project through Expo prebuild when needed, builds the development client, installs it, and launches it. If no Android target is online, it starts the `medium_phone` emulator.

When one target is online, the scripts use it automatically. When a real phone and an emulator are online together, select the first target of either type:

```sh
pnpm android emu
pnpm android phone
```

The `phone` and `emu` selectors also work with `pnpm android:seed-account`, `pnpm test:android`, `pnpm test:deep-links`, `pnpm test:account:live`, and `pnpm check`. Set `ANDROID_SERIAL` instead when you need an exact target among multiple phones or emulators. Device tests install builds on the selected target, and the live account test also clears this app's data there.

Fill the emulator's Camera and Screenshots collections with random JPEGs from
[Lorem Picsum](https://picsum.photos/):

```sh
pnpm android:seed-photos
PHOTO_COUNT=20 pnpm android:seed-photos
```

The script targets emulators only and waits until Android MediaStore indexes
every downloaded image.

Project automation is grouped by purpose: `scripts/setup.sh` prepares the project, `scripts/android/` contains Android environment, targeting, and launch helpers, `scripts/test/` contains test and verification runners, and `scripts/assets/` contains generated-asset tooling. Each script starts with its purpose, command, prerequisites, and material side effects.

Run every required check with one command. The suite now includes a live stress
test on both an authorized phone and emulator, and requires `test-creds.tct`:

```sh
pnpm check emu
```

This command clean-reinstalls this app on **both targets**, clearing its account,
backup configuration, queue, and history. Other apps and your original photos
are left alone. `emu` selects the target for the preceding instrumentation and
deep-link checks; the stress phase always runs phone and emulator concurrently.

### Live stress test

Run the device stress phase alone with `pnpm test:stress`. It downloads six
photographs from Lorem Picsum and generates 2,000 distinct JPEGs per device in
Camera and Screenshots, then clean-reinstalls a bundled test build. It backs up
only the generated photos through a test-owned SAF provider, using the real
discovery, Room queue, WorkManager, and Nextcloud upload code. Your original
photos are excluded from the test backup.

The runner checks navigation and thumbnails during uploads, 150% system text,
emulator dark mode, the account dialog with its keyboard open,
cold-start/process recovery, remote file counts, three downloaded SHA-256 samples
per device, and Android crash/ANR records. The emulator uses a TLS-preserving
CONNECT proxy with 96 KiB/s per connection/direction, 750 ms connection latency,
and an intentional 15-second outage. It runs on battery for 25 minutes after
process recovery, then simulates plugging in to check background continuation
under Android's normal power rules. Job quotas are not disabled or reset.
Phone networking and power settings are unchanged.
Background progress is read from test-only status files, without repeatedly
binding the app and altering Android's background-network eligibility.

Allow time for the Samsung: photo creation and installation can take minutes,
and uploads have a two-hour deadline per target. Override `STRESS_PHOTO_COUNT`
to test 2,000–20,000 photos or `STRESS_TIMEOUT_MINUTES` for a longer run. Use
`STRESS_PHONE_SERIAL` and `STRESS_EMULATOR_SERIAL` when multiple devices exist.

Reports and screenshots are written under ignored `test-results/stress-*/`.
Cleanup removes only that run's generated media and remote directory, restores
emulator proxy, power, and system text settings, and reinstalls the normal release build.
The test build uses separate Gradle variant `stress`; its acceptance provider
is never included in release. Credentials are read from the ignored file and
redacted from command output. Screenshots can show account display information,
so review them before sharing. Cleanup failures are test failures and remain in
the result JSON for recovery.

`test:native` generates the ignored Android project when necessary, loads the
pinned SDK/JDK environment, and runs the Kotlin engine module tests.

`test:deep-links` builds and installs a release APK with its JavaScript bundle
embedded, then verifies the Sources and Activity routes from a stopped process.
This avoids Expo's development-client launcher intercepting the cold-start links.

`test:privacy` checks the production dependency declarations for known telemetry
or advertising SDKs, then inspects a release APK for overlay and advertising-ID
permissions while preserving the permissions the upload engine requires.

## Local credentials

`test-creds.tct` is ignored and reserved for live acceptance tests. Never commit, bundle, print, or copy it into ordinary test output.

With an Android target selected, the debug-only account acceptance path can
consume that file without printing its values:

```sh
pnpm test:account:live emu
```

The harness clears only WebDAV Auto Upload's app data on the selected target, drives the manual
app-password form, force-stops the app, and verifies that Kotlin can authenticate
again from Android Keystore-backed storage. It then creates two valid bitmap
images in the target's Camera collection, discovers them through MediaStore,
uploads one directly and the larger image through Nextcloud chunking when the
server advertises it, and compares the downloaded SHA-256 hashes. Each run uses
and removes its own remote folder and target media. The test harness is
packaged separately from the application APK.

## License

WebDAV Auto Upload is licensed under GPL-3.0-or-later. Third-party packages and retained scaffold assets remain under their respective licenses.
