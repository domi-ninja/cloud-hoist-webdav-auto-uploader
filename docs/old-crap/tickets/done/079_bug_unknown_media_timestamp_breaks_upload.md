# 079 Unknown media timestamp breaks upload

Status: complete

Found while working on: 078

## Bug

MediaStore discovery represents an absent modification timestamp as `0`. Both
upload paths send every non-null timestamp to Nextcloud, including zero, as
`X-OC-MTime` or `X-OC-CTime`.

## Impact

Nextcloud requires these headers to contain positive Unix timestamps. A local
image with missing or zero metadata receives HTTP 400 and enters retry state
even though its bytes are readable and its destination is valid.

## Fix

Send modification and creation headers only when their value is greater than
zero. Keep the stored zero value for stable revision identity when Android has
no timestamp.

## Acceptance criteria

- Direct uploads omit zero or negative modification and creation times.
- Chunk finalization omits zero or negative modification and creation times.
- Positive timestamps are still sent unchanged.
- A generated emulator image with unknown timestamp uploads successfully.

## Open question

**Question:** Should the client replace an unknown source timestamp with the
current upload time?

**Default:** No. Omit the header and let Nextcloud assign its normal upload time.
Inventing source metadata would be misleading.
