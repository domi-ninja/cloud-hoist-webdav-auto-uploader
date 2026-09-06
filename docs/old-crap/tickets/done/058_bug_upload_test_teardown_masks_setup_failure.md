# 058 Bug: upload test teardown masks setup failure

Status: done

## Found while

Running ticket 005's first direct-upload acceptance test on the emulator.

## Symptom

The test reports that `server` was never initialized in teardown. This hides the exception that stopped MockWebServer setup.

## Cause

The test assigns the `lateinit` property only after an `apply` block finishes. If server startup throws inside that block, JUnit still runs teardown against the unassigned property.

## Fix

Assign the MockWebServer property before configuring and starting it. Teardown can now shut down a partially started server, and JUnit preserves the setup failure.

## Acceptance criteria

- A setup failure no longer produces `UninitializedPropertyAccessException` in teardown.
- The upload acceptance test can report its original failure.

## Open question

**Question:** Should every fixture use nullable resources instead of `lateinit`?

**Default:** No. Assign owned resources before the first operation that can throw. It keeps normal test code simpler and still makes teardown safe.
