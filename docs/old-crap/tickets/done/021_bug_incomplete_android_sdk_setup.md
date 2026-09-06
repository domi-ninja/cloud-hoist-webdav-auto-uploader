# 021 Install the complete native Android toolchain

Status: completed

## Resolution

Setup explicitly installs API 36, build-tools 35 and 36, NDK 27.1.12297006, CMake 3.22.1, platform tools, the emulator, and the Google Play API 36 image.

Found while working on: 001

## Bug

`android:setup` installed the app's compile platform and build tools, but the first React Native build also needed NDK 27.1.12297006, build-tools 35.0.0, and CMake 3.22.1. Gradle downloaded them implicitly.

## Impact

A supposedly prepared machine still mutates its SDK during the first build, making failures slower and harder to diagnose offline.

## Fix

Add the transitive native build requirements to `android:setup` and document why both build-tools versions are intentional.

## Acceptance criteria

- `android:setup` explicitly installs the compile platform, both build-tools versions, the NDK, CMake, emulator, platform tools, and the pinned system image.
- Re-running setup is idempotent.
- A subsequent Android build does not discover another missing SDK package.

## Open question

**Question:** Should every transitive Android package be exposed in `TECH_STACK.md`?

**Default:** No. Keep product-level versions there and keep build-only package pins next to the reproducible setup script.
