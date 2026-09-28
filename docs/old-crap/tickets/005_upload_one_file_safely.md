# 005 Upload one file with safe overwrite

Status: archived specification. Implementation exists; see [current tracking](../../tickets/README.md) for remaining validation and superseding decisions. Historical acceptance criteria below are not a completion claim.

Depends on: 002, 003

## Outcome

The Kotlin engine can upload one content URI to a Nextcloud destination, preserve timestamps where supported, and replace an existing destination only after the complete new payload reaches the server.

## Work

- Implement a DAV transport with explicit request and response types, bounded timeouts, cancellation, and redacted logging.
- Create missing destination directories with explicit `MKCOL` calls for broad server compatibility.
- Stream the content URI. Do not load the complete file into Kotlin or JavaScript memory.
- Upload small files to a unique hidden sibling temporary path.
- Send original modification and creation timestamps where Android and Nextcloud expose them. Check the server's timestamp-accepted response headers.
- Finalize with a DAV `MOVE` to the destination using overwrite semantics. A failed upload or finalize step must leave the previous destination untouched.
- Clean up known temporary uploads after success or a definite permanent failure. Keep enough information to retry uncertain failures safely.
- Map HTTP, DAV, storage, authentication, quota, certificate, and cancellation results into the engine's typed result model.
- Add a development-only fixture action to exercise this path before source discovery exists. Keep it out of production navigation.

## Acceptance criteria

- A binary fixture uploads byte-for-byte without passing through React Native.
- Uploading the same destination twice replaces it with the second complete file.
- Killing the app or cutting the network during transfer never replaces the existing destination with partial content.
- Missing parent folders are created.
- Empty files, Unicode filenames, spaces, and reserved path characters work.
- Definite quota, authentication, certificate, missing-local-file, and server failures return separate typed outcomes.
- Authorization headers, credentials, full local paths, and remote filenames do not leak into ordinary logs.

## Verification

- Unit-test path building, result mapping, redaction, and temporary-name generation.
- Integration-test success, overwrite, interrupted transfer, and cleanup against a disposable Nextcloud account.
- Compare downloaded fixture hashes after upload.

## Not in this ticket

- Chunked uploads
- Durable queueing
- Background scheduling
- User-facing manual upload

## Open question

**Question:** Where should the temporary object live before the final overwrite?

**Default:** Use a unique hidden sibling in the destination directory, then `MOVE` it over the final name. Same-directory finalization avoids cross-storage moves and keeps the old destination intact until completion.
