# 052 Bug: generic instrumentation runs live credential tests

Status: done

## Found while

Running the complete Android instrumentation suite for ticket 008 after an emulator reboot.

## Symptom

Eighteen emulator tests pass, but both `LiveAccountAcceptanceTest` methods fail because `launchUrlB64` was not supplied to the generic Gradle test run.

## Cause

The live account tests are designed to be invoked individually by the opaque credential runner. They treated their runner-only arguments as unconditional even when Android discovered them as part of the normal instrumentation suite.

## Fix

- Skip live account UI tests when their runner-only launch argument is absent.
- Keep malformed arguments as hard failures when the dedicated runner supplies them.
- Rerun the complete emulator suite without credentials.

## Acceptance criteria

- `connectedDebugAndroidTest` passes without live credential arguments.
- The dedicated account runner can still target each live test with its encoded launch URL.
- A supplied malformed value still fails rather than silently skipping.

## Verification

- The complete Android 16 emulator run succeeds with the two live account methods reported as skipped and the remaining instrumentation tests passing.
- Argument decoding remains unchanged after the presence check, so malformed supplied values still throw.

## Open question

**Question:** Should live acceptance tests move to a separate Gradle source set?

**Default:** Not yet. Assumption-based skipping is enough while there are only two explicitly targeted tests.
