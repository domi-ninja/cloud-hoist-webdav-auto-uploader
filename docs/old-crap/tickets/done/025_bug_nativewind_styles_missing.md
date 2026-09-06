# 025 Make NativeWind utilities apply on Android

Status: completed

## Resolution

The configuration and generated utility set were correct. Metro retained a zero-style virtual module from the earlier missing-runtime failure; restarting with a cleared graph regenerated the native stylesheet, and the emulator visibly applies the utilities.

Found while working on: 001

## Bug

The app bundles and renders, but NativeWind utility classes have no visible effect. The bootstrap content stays at the top-left without the requested padding, centering, spacing, or typography.

## Impact

The styling stack appears installed while silently doing nothing on Android.

## Fix

Validate the Babel transform, generated CSS, Metro wrapper, and runtime registration against the installed NativeWind version. Correct the minimal configuration and verify it visually.

## Acceptance criteria

- The bootstrap content is centered with visible padding and spacing.
- Background and text colors follow the utility classes.
- TypeScript still recognizes `className` on React Native primitives.

## Open question

**Question:** Should the bootstrap include a runtime assertion for NativeWind?

**Default:** No. Keep a small visible canary screen and cover configuration with static tests rather than shipping a styling self-test.
