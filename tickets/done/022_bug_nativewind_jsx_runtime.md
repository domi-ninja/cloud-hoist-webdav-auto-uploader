# 022 Make NativeWind's JSX runtime resolvable under pnpm

Status: completed

## Resolution

`react-native-css-interop` 0.2.6 is a direct dependency. Metro resolves the injected JSX runtime and completes the Android bundle.

Found while working on: 001

## Bug

The development client installs, but Metro cannot resolve `react-native-css-interop/jsx-runtime` while transforming the first Expo Router screen.

## Impact

The app opens to a bundle error instead of rendering the React Native UI.

## Fix

Declare the NativeWind runtime package explicitly at the compatible version, then rebuild the Metro dependency graph.

## Acceptance criteria

- Metro bundles the Expo Router entry without a missing-module error.
- The NativeWind-styled bootstrap screen renders on the emulator.
- A frozen pnpm install retains the runtime dependency.

## Open question

**Question:** Should pnpm's hoisting be loosened for React Native packages?

**Default:** No. Keep strict dependency resolution and declare the runtime dependency the app actually consumes.
