# WebDAV Auto Upload

WebDAV Auto Upload is an Android app for automatic uploads to Nextcloud servers. It is an independent project and is not affiliated with or endorsed by Nextcloud GmbH.

The first release is under development. The accepted product and engineering decisions live in `PLAN.md`, and implementation work is tracked in `tickets/`.

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

Project automation is grouped by purpose: `scripts/setup.sh` prepares the project, `scripts/android/` contains Android environment, targeting, and launch helpers, `scripts/test/` contains test and verification runners, and `scripts/assets/` contains generated-asset tooling. Each script starts with its purpose, command, prerequisites, and material side effects.

Run every required check with one command:

```sh
pnpm check emu
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
