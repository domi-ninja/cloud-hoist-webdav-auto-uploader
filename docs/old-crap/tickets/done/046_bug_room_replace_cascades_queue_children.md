# 046 Room replace cascades queue children

Status: complete

Found while working on: 006

## Bug

Account and source writes used `@Insert(REPLACE)`. SQLite implements replace by
deleting the conflicting row and inserting another one, which fires foreign-key
cascades.

## Impact

Refreshing account metadata could delete every source and job. Editing one
source could delete its revision ledger and unfinished queue.

## Fix

Use Room's `@Upsert` for mutable parent records. It updates an existing row
without deleting its identity or children.

## Acceptance criteria

- Updating account fields preserves sources, revisions, and jobs.
- Updating source fields preserves revisions and jobs.
- New account and source records still insert normally.

## Open question

**Question:** Should immutable records also use upsert?

**Default:** No. Revisions, jobs, and attempts must fail or ignore according to
their explicit identity rules. Silent mutation would weaken deduplication.
