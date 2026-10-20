# 024 Verify and fix app launch after emulator install

Status: completed

## Resolution

Worklets and Reanimated are pinned to the known-good SDK 57 pair, 0.10.0 and 4.5.0. The rebuilt app remains alive and foregrounded after rendering its first React tree.

Found while working on: 001

## Bug

Expo reports that it opened the development-client URL, but the app crashes with `SIGSEGV` on the JavaScript thread and the emulator returns to the Android launcher.

## Impact

The deploy command can exit its install phase looking successful while the developer sees no app.

## Fix

The crash matches the SDK 57 Worklets/Reanimated 0.10.1/4.5.1 startup regression. Pin the known-good 0.10.0/4.5.0 pair required transitively by Expo Router and NativeWind, rebuild native code, and verify the foreground process after launch.

## Acceptance criteria

- `pnpm android` leaves Cloud Hoist in the foreground.
- The application process is running under `ninja.domi.cloudhoist`.
- An emulator screenshot shows the React Native bootstrap screen.

## Open question

**Question:** Should launch verification fail the long-running Metro process automatically?

**Default:** Keep Metro attached for development, but perform a bounded foreground/process check before handing control to its log stream.
