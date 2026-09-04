# 051 Bug: media permission result is not bridge serializable

Status: done

## Found while

Selecting Camera through the source onboarding UI on the Android 16 emulator for ticket 008.

## Symptom

After Android grants photo and video access, the development build shows an Expo `UnexpectedException` instead of the source preview. The bridge reports `Unknown type: MediaPermissionState`.

## Cause

The media permission callbacks resolve an Expo promise with a Kotlin data class. Expo promise values must use bridge-supported primitives and collections; the synchronous discovery endpoints already convert their result records to maps.

## Fix

- Convert permission state to its plain map representation before resolving the Expo promise.
- Exercise the same permission path through the installed app on the emulator.

## Acceptance criteria

- Granting full or limited media access returns to React Native without a native error screen.
- TypeScript receives the existing `{ access, canAskAgain }` contract.
- Camera preview loads after the permission result.

## Verification

- Native unit suite passes.
- Debug APK assembles and installs on the Android 16 emulator.
- Revoking media access, selecting Camera, choosing `Allow all`, and returning to the app produces the `Camera · 0 files · 0 B` preview without a native error screen.

## Open question

**Question:** Should the bridge accept Kotlin data classes directly in the future?

**Default:** No. Keep explicit map conversion at the module boundary so the serialized contract remains obvious.
