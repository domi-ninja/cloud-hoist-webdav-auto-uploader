# 078 Live acceptance stops after login

Status: complete

Found while working on: 014

## Bug

`pnpm test:account:live` reports success after account authentication and an
encrypted credential reload. It does not create emulator media, discover a
source, drain the real upload queue, compare remote bytes, or exercise Nextcloud
chunked upload.

## Impact

A green live run can hide failures in MediaStore discovery, Room queue creation,
the worker upload clients, Nextcloud DAV paths, chunk assembly, and cleanup.
Ticket 014's live-server acceptance criteria remain untested.

## Fix

- Generate valid small and larger-than-threshold image fixtures on the host.
- Insert both fixtures into the emulator's Camera collection.
- Connect with `test-creds.tct` without printing any credential value.
- Create a unique remote folder for the run.
- Discover the Camera source and drain the same upload path used by WorkManager.
- Download both remote files and compare their SHA-256 hashes with the fixtures.
- Confirm the larger image used chunked upload when the server advertises it.
- Delete only the run-owned local media and remote folder after verification.
- Keep failure output free of credentials and authorization headers.

## Acceptance criteria

- One command proves authentication, process-death credential reload, MediaStore
  discovery, Room queue transitions, direct upload, chunked upload when
  supported, remote byte equality, and scoped cleanup.
- The command fails if any expected job is absent, blocked, retrying, or not
  byte-identical remotely.
- Existing emulator media and remote files are never changed.
- No production APK can read the host credential file or invoke test controls.

## Open question

**Question:** Should the acceptance fixtures remain on the emulator after a
successful run for manual inspection?

**Default:** No. Remove only the uniquely named fixtures created by the run so
repeat runs remain isolated.
