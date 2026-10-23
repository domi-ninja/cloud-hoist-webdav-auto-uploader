# Development and testing

[README](../README.md) · [Architecture](architecture.md) · [Publishing](publishing.md)

## Setup

Use Linux x86-64 with Git and nvm installed. KVM is needed for the emulator.

```sh
./scripts/setup.sh
```

Setup installs the project dependencies, Android CLI, SDK components, and JDK when needed, and creates the API 36 `medium_phone` emulator. Node is pinned in `.nvmrc`; pnpm and the JavaScript runtime are pinned in `package.json`.

## Run

```sh
nvm use
pnpm android emu
```

`pnpm android` uses the single connected target, or starts the emulator when none is online. `pnpm android phone` selects a phone. Set `ANDROID_SERIAL` to select an exact device when several are connected.

Development builds use a different signing key from distributed betas. Use an emulator or disposable installation for them. Replacing a beta with a development build requires uninstalling the beta, which removes its local account, settings, queue, and history.

For the user's configured phone, build and install a signed update through [Publishing](publishing.md). `pnpm android:install` verifies the release key, installs in place, and launches the app without clearing data.

## Checks without a device

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:native
pnpm test:release
pnpm test:publish
```

Native unit tests need the Android SDK and JDK. `pnpm test:privacy` builds and inspects an APK for prohibited permissions and known analytics or advertising dependencies. `pnpm icons:check` verifies generated icon assets against their source.

## Phone validation

Select the phone explicitly with `ANDROID_SERIAL`. Install the signed APK in place, inspect the affected screens, and exercise the changed controls. For upload changes, use generated files in an isolated folder and compare uploaded files with downloaded SHA-256 hashes. Remove only test-owned files and configuration. Preserve existing accounts, backup folders, queues, history, media, and device settings.

Save screenshots and results under ignored `test-results/`. Record the device, Android version, app version, checks performed, and failures. Review screenshots before sharing them; they can show account names and file paths.

Native destination-change tests use an isolated in-memory Room database in the test APK. They cover custom suffixes, disabled sources, shared destinations, automatic collision renaming, identical-content deletion, the 20/21-file hashing cutoff, missing files, interrupted MOVE and DELETE responses, concurrent collisions, retries, and switching a partial move to uploads. `DestinationChangeLiveTest` uses unique server folders and downloaded SHA-256 hashes to check moves, duplicate deletion, numbered collisions, and queued copies, never the app's configured backups. After building and installing the engine test APK, run `ANDROID_SERIAL=<phone> node scripts/test/destination-live.mjs`. It reads the ignored test credentials, redacts output, and removes only its own UUID-named server directory.

## Destructive test runners

These are for disposable test installations. Do not run them against the user's configured app.

| Command | Effect |
| --- | --- |
| `pnpm test:android emu` | Installs native test APKs and writes Room, preferences, and WorkManager state in the test host. |
| `pnpm test:account:live emu` | Installs test builds, clears app data, authenticates against a real server, verifies direct and chunked uploads, and removes its fixtures. |
| `pnpm test:stress` | Clean-reinstalls the app on both a phone and an emulator, resets local app data, creates at least 2,000 test photos per device, and exercises uploads and recovery. |
| `pnpm check emu` | Runs the combined checks, including the destructive stress phase on both devices. |

Live runners read the ignored `test-creds.tct` file. It accepts JSON with `serverUrl`, `username`, and `appPassword`. Use a dedicated test account; never commit, print, or package its credentials. The stress runner accepts `STRESS_PHONE_SERIAL`, `STRESS_EMULATOR_SERIAL`, `STRESS_PHOTO_COUNT`, and `STRESS_TIMEOUT_MINUTES`. Its reports are under `test-results/stress-*/`.

`pnpm test:deep-links` installs a debug-signed release build and force-stops the app. Its home-screen assertion still expects `Cloud Hoist`; update it to `Backups` before using it as a release check. The combined `pnpm check` runner includes this legacy assertion.

No completed seven-day device soak or Nextcloud server-version compatibility matrix is recorded in the repository. Short UI checks do not establish either.
