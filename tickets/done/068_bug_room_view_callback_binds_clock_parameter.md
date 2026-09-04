# 068 Bug: Room view callback binds the clock parameter

Status: done

## Found while

Compiling the production bridge replacement for fixture engine state.

## Symptom

Kotlin treats the snapshot invalidation lambda as the view's zero-argument clock and reports a missing invalidation callback.

## Cause

The constructor's optional clock is its last function parameter, so trailing-lambda syntax binds to the clock instead of the required callback before it.

## Fix

Name both the DAO and invalidation callback arguments at the module construction site.

## Acceptance criteria

- The production module compiles.
- Snapshot invalidations still emit their numeric revision.

## Open question

**Question:** Should the constructor reorder its function parameters?

**Default:** No. Named arguments make the unusual call site explicit without designing around one test seam.
