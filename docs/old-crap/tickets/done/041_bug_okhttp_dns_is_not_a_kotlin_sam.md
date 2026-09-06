# 041 OkHttp DNS override does not compile as a Kotlin SAM

Status: complete

Found while working on: 040

## Bug

The debug provider tried to construct OkHttp's `Dns` interface with lambda/SAM
syntax. Kotlin 2.1 rejects that interface as non-constructible.

## Impact

The native module does not compile, so neither unit nor emulator tests can run.

## Fix

Implement `Dns` with an explicit object and typed `lookup` override.

## Acceptance criteria

- Debug Kotlin compiles.
- The override maps only the configured Nextcloud hostname.
- Every other hostname delegates to Android's system resolver.

## Open question

**Question:** Should this compatibility wrapper become a production class?

**Default:** No. Keep it next to the debug provider unless production code needs
custom DNS later.
