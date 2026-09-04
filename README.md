# WebDAV Auto Upload

WebDAV Auto Upload is an Android app for automatic uploads to Nextcloud servers. It is an independent project and is not affiliated with or endorsed by Nextcloud GmbH.

The first release is under development. The accepted product and engineering decisions live in `PLAN.md`, and implementation work is tracked in `tickets/`.

## Development requirements

- Linux on x86-64 with KVM available
- Git
- JDK 21; setup installs pinned Temurin 21.0.12.1 when no compiler is available
- Node.js 24.20.0 through nvm
- pnpm 11.3.0
- Google's Android CLI

Install the user-local Android CLI from Google's official installer:

```sh
curl -fsSL https://dl.google.com/android/cli/latest/linux_x86_64/install.sh -o /tmp/android-cli-install.sh
bash /tmp/android-cli-install.sh
```

The tested Android CLI version is `1.0.16261425`. Its built-in help accepts the emulator profile as a positional argument even though an earlier documentation example used `--profile`.

## First setup

```sh
nvm install
nvm use
corepack enable
corepack prepare pnpm@11.3.0 --activate
pnpm install --frozen-lockfile
pnpm android:setup
```

`android:setup` installs Android SDK Platform 36, Build Tools 36.0.0 and 35.0.0, NDK 27.1.12297006, CMake 3.22.1, and creates Google's `medium_phone` API 36 emulator if it does not exist. Build Tools 35 and CMake are explicit React Native transitive requirements.

## Run on the emulator

```sh
nvm use
pnpm android
```

The command resolves Google's user-local SDK, starts `medium_phone` if no emulator is ready, generates the Android project through Expo prebuild when needed, builds the development client, installs it, and launches it.

Use these checks before committing application changes:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:native
pnpm test:deep-links
pnpm test:privacy
```

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

With the configured emulator running, the debug-only account acceptance path can
consume that file without printing its values:

```sh
pnpm test:account:live
```

The harness clears only WebDAV Auto Upload's emulator app data, drives the manual
app-password form, force-stops the app, and verifies that Kotlin can authenticate
again from Android Keystore-backed storage. It then creates two valid bitmap
images in the emulator's Camera collection, discovers them through MediaStore,
uploads one directly and the larger image through Nextcloud chunking when the
server advertises it, and compares the downloaded SHA-256 hashes. Each run uses
and removes its own remote folder and emulator media. The test harness is
packaged separately from the application APK.

## License

WebDAV Auto Upload is licensed under GPL-3.0-or-later. Third-party packages and retained scaffold assets remain under their respective licenses.
