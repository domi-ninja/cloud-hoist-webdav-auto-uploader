# 047 Disabled sources remain claimable

Status: complete

Found while working on: 006

## Bug

The oldest-first claim query selected eligible job states without joining their
source. Jobs from a disabled or blocked source remained claimable.

## Impact

Turning off a source would not stop new uploads, and a lost folder permission
could still feed work to the transfer worker.

## Fix

Join sources in the claim subquery and require the source to be enabled with no
active blocker.

## Acceptance criteria

- Disabled sources yield no claim.
- Blocked sources yield no claim.
- Re-enabling or clearing the blocker makes the oldest eligible job claimable.

## Open question

**Question:** Should disabling a source cancel its currently running upload?

**Default:** No. Stop new claims. Ticket 010 will define safe cancellation for a
transfer that has already started.
