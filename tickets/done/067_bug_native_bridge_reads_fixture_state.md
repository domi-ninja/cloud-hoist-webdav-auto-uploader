# 067 Bug: native bridge reads fixture state instead of the upload database

Status: done

## Found while

Connecting the completed queue and foreground worker to the React Native app.

## Symptom

The UI always shows a hard-coded Camera source and zero real uploads. Source setup writes to Room, but snapshot, activity, retry, and legacy source commands read or mutate a separate in-memory fixture.

## Cause

The typed native module bootstrap retained its deterministic fixture after durable repositories and workers were added.

## Fix

- Produce bridge snapshots, source summaries, activity, failures, and blockers from Room.
- Route retry and source mutations to Room.
- Keep one in-process invalidation revision for React Native query refreshes.
- Remove the fixture from the production module.

## Acceptance criteria

- A source committed through onboarding appears in the Sources snapshot.
- Queue counts and recent jobs reflect Room state.
- Running and chunked jobs expose durable progress.
- Retry, remove, and reset-history commands mutate the same state workers use.
- The production module no longer constructs `FixtureUploadEngine`.

## Verification

- Room-backed snapshot and mutation tests pass on the API 36 emulator.
- The TypeScript contract suite accepts the new job blocker shape.
- A rebuilt development client cold-starts with the Room bridge and no native or Zod error in logcat.

## Open question

**Question:** Should every transfer progress callback cross the React Native bridge?

**Default:** No. Room exposes durable coarse progress and the foreground notification handles live byte updates without waking JavaScript for every buffer.
