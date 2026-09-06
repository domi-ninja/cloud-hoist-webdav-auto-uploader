# 056 Bug: workers open duplicate Room databases

Status: done

## Found while

Connecting ticket 009's headless workers to the durable queue.

## Symptom

Every source scan creates another `EngineRoomDatabase` instance for the same on-disk file. Periodic work can therefore retain duplicate connection pools for the lifetime of the app process.

## Cause

`EngineRoomDatabase.open` builds and returns a fresh Room database on every call.

## Fix

- Cache one process-wide database built with the application context.
- Synchronize first initialization so simultaneous workers cannot create competing instances.

## Acceptance criteria

- Repeated and concurrent calls return the same database instance.
- Existing in-memory Room tests remain isolated.

## Verification

- A four-caller Android instrumentation test starts database access concurrently and confirms every caller receives the same instance.

## Open question

**Question:** Should callers own and close the production database?

**Default:** No. Treat it as a process-lifetime service; only explicitly created test databases are caller-owned.
