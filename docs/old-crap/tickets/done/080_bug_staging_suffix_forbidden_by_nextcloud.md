# 080 Staging suffix is forbidden by Nextcloud

Status: complete

Found while working on: 078

## Bug

Direct and chunked uploads stage completed bytes under a hidden sibling whose
name ends in `.part`. Nextcloud always forbids that extension because the server
reserves it for its own internal transfer files.

## Impact

Nextcloud rejects the staging `PUT` or chunk assembly `MOVE` with HTTP 400. The
queue retries an upload that cannot succeed, and no user file reaches its final
destination.

## Fix

Keep the unique hidden sibling design, but end the staging name with the upload
UUID instead of a reserved extension. Continue moving the completed staging
file over the destination only after all bytes arrive.

## Acceptance criteria

- No client-created remote staging name ends in `.part` or `.filepart`.
- Direct and chunked uploads still use unique hidden siblings.
- Existing destinations remain untouched until the staging upload completes.
- Definite failures still attempt to delete the exact staging object.
- Direct and chunked emulator fixtures upload byte-for-byte to Nextcloud.

## Open question

**Question:** Should the staging suffix imitate a known Nextcloud internal name?

**Default:** No. Use `.filename.cloud-hoist-<uuid>` so the final extension
is the unique identifier and does not collide with a server-reserved suffix.
