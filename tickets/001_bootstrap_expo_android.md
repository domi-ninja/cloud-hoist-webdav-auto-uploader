# 001 Bootstrap the Expo Android app

Status: ready

Depends on: none

## Outcome

WebDAV Auto Upload launches as an Expo development build on the Android emulator. The repository has the agreed TypeScript, Expo Router, NativeWind, package, and quality-tool foundation without copying application code from `dictation-eu`.

## Work

- Create the Expo app in the existing repository without replacing `TECH_STACK.md`, `PLAN.md`, `.git`, or `tickets/`.
- Use the current stable Expo-compatible React Native and React versions. Install packages with pnpm and commit `pnpm-lock.yaml`.
- Set the display name to `WebDAV Auto Upload`, slug to `webdav-auto-upload`, and Android package to `ninja.domi.webdavautoupload`.
- Enable strict TypeScript. Do not introduce `any` or casting helpers.
- Configure NativeWind 4 and Tailwind CSS 3 using `dictation-eu` as a configuration reference only.
- Configure Expo Router with one minimal initial route. Do not build the final tabs in this ticket.
- Add scripts for starting Expo, running Android, typechecking, linting, and focused tests.
- Configure Android-only development. Remove scaffolded web and iOS code that the app does not use.
- Add the GPL-3.0-or-later license and a short README that states the project is independent and currently supports Nextcloud servers.
- Document the emulator name, required Android SDK pieces, and exact command used to run the development build.
- Preserve the `test-creds.tct` ignore rule. The local acceptance credential file must never enter Git, an APK, build output, Metro assets, or logs.

## Acceptance criteria

- `pnpm install --frozen-lockfile` succeeds from a clean checkout.
- The TypeScript compiler and linter pass.
- `pnpm android` installs and opens the development build on the chosen emulator.
- The first route renders one NativeWind-styled React Native view.
- The installed Android app reports package `ninja.domi.webdavautoupload`.
- No Convex, authentication, audio, or other feature dependency from `dictation-eu` is copied.
- The working tree contains no generated secrets, emulator state, native build output, or `node_modules`.
- `git check-ignore test-creds.tct` succeeds, and a build artifact inspection finds no copy of that file.

## Verification

- Run the typecheck, lint, and test scripts.
- Start the emulator from a cold boot and launch the app through the documented command.
- Inspect the installed package with `adb shell pm list packages`.

## Not in this ticket

- Nextcloud login
- Native upload code
- Final screens or visual design
- Production signing or store metadata

## Open question

**Question:** Which exact Expo SDK should bootstrap use if a newer stable release exists than the SDK 54 reference project?

**Default:** Use the stable SDK selected by the current official `create-expo-app`, then install every Expo package through `expo install` and pin the resulting dependency graph in `pnpm-lock.yaml`.
