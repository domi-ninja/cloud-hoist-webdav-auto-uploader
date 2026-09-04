# 019 Fix SDK 57 Android prebuild and device selection

Status: completed

## Resolution

The obsolete edge-to-edge setting was removed, `expo-system-ui` was installed, and the emulator is selected through `ANDROID_SERIAL`. Prebuild and installation complete without the original warnings or device lookup failure.

Found while working on: 001

## Bug

The first `pnpm android` run exposed three SDK 57 mismatches: Android 16 rejects the obsolete `edgeToEdgeEnabled` app setting, automatic system appearance needs `expo-system-ui`, and Expo CLI does not match an adb serial passed as the `--device` name.

## Impact

Prebuild emits avoidable warnings and deployment stops before Gradle because it cannot find a device named `emulator-5554`.

## Fix

- Remove `edgeToEdgeEnabled`; edge-to-edge is mandatory for the target SDK.
- Install the SDK-compatible `expo-system-ui` package.
- Select the already-resolved emulator through `ANDROID_SERIAL` and let `expo run:android` use adb's selection.
- Re-run prebuild, build, install, and launch.

## Acceptance criteria

- Prebuild emits neither the edge-to-edge nor missing-system-UI warning.
- The run script targets the running emulator without an interactive device prompt.
- The development client installs and launches.

## Open question

**Question:** Should the run script support choosing among several connected Android devices now?

**Default:** No. Target the first ready emulator for reproducible development and add device selection only when physical-device work begins.
