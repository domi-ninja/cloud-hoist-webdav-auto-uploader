# 069 Bug: connected account duplicates source setup

Status: done

## Found while

Driving the new source setup flow on the emulator.

## Symptom

The connected screen renders two copies of “Choose what to upload.” One is the real atomic setup flow; the other is an old picker prototype embedded in the account card and cannot save anything.

## Cause

The account connection component retained local and remote picker state from the early native-module UI spike.

## Fix

Keep the connected account component focused on account identity and verification. Source setup is owned solely by `SourceSetup` on the Sources screen.

## Acceptance criteria

- A connected account shows exactly one source setup flow when no source exists.
- The visible flow can continue through review and commit.
- Account verification remains available.

## Open question

**Question:** Should account verification remain on the main Sources screen?

**Default:** Yes for the first release. Move it to Settings only after the tab layout exists.
