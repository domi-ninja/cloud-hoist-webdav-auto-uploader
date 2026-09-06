# 073 Prevent an in-flight scan from restoring a removed source

Status: done

Found while working on: 013

## Bug

Source discovery read a source before walking Android storage, then used an
upsert when recording the result. If the user removed that source during the
walk, the late result recreated it with newly queued work.

## Impact

A confirmed removal could silently undo itself and continue auto-uploading from
a source the user had explicitly stopped watching.

## Fix

Record rescans through a Room transaction that first proves the source still
exists. Initial source creation keeps its atomic upsert path. Source removal also
releases its persisted SAF read grant when no remaining source shares that URI.

## Acceptance criteria

- Removing a source during discovery leaves it removed.
- The late scan writes no revisions or jobs.
- Initial source setup remains atomic.
- The 20-test DAO emulator suite passes.
