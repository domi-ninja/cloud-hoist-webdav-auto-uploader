# 057 Bug: Room schema is generated after test assets

Status: done

## Found while

Running the new Room 2 to 3 migration test for scoped transfer blockers.

## Symptom

A clean Android test build fails because `3.json` is absent from the migration test APK, even though KSP writes the file later in the same Gradle invocation.

## Cause

Gradle merges Android test assets before `kspDebugKotlin`. The migration helper therefore sees only schemas that existed before the build started.

## Fix

Make Android test asset merging depend on the main debug KSP task. The generated schema exists before Gradle packages the test APK.

## Acceptance criteria

- A newly generated Room schema ships in the same clean Android test build.
- The migration helper can load schema v3 without a second Gradle invocation.

## Open question

**Question:** Should we restore Room's Gradle plugin for schema wiring?

**Default:** No. Expo's plugin repositories cannot currently resolve it in this project. Keep the small explicit task dependency until that changes.
