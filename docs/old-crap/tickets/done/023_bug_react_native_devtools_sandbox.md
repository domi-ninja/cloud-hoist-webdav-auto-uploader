# 023 Stop DevTools from breaking the normal emulator command

Status: completed

## Resolution

The Android run command sets Expo's headless flag, which prevents automatic standalone DevTools installation while keeping Metro attached to the emulator.

Found while working on: 001

## Bug

Metro automatically tries to open React Native DevTools. Its downloaded Chromium sandbox is not root-owned with mode 4755, so Chromium aborts and prints a fatal host error.

## Impact

The normal deploy command emits a frightening fatal error even though the Android app and Metro can continue.

## Fix

Disable automatic DevTools launch in the reproducible Android run script. Keep manual DevTools use separate from app deployment.

## Acceptance criteria

- `pnpm android` does not launch React Native DevTools.
- Metro remains attached and serves the emulator.
- The app can be inspected through logs without changing host sandbox permissions.

## Open question

**Question:** Should setup mutate the downloaded Chromium sandbox to enable DevTools?

**Default:** No. Do not require a root-owned executable for the baseline app workflow; add an opt-in developer-tool command later if it becomes useful.
