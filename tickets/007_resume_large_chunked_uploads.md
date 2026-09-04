# 007 Resume large chunked uploads

Status: blocked by 006

Depends on: 003, 005, 006

## Outcome

Large uploads use Nextcloud chunked-upload v2 when available. Completed chunks and the upload session survive interruption so the worker resumes instead of restarting the whole file.

## Work

- Read chunking support and advertised limits from the stored capability snapshot.
- Choose a conservative default threshold and chunk size within Nextcloud's documented bounds.
- Create a unique upload collection, upload zero-padded numeric chunks, and send the total length.
- Persist the upload ID, source revision, destination, chunk size, and confirmed chunks in Room.
- Reconcile a persisted session with a DAV `PROPFIND` after process death. Trust neither the server nor local checkpoint alone when they disagree.
- Finalize through the chunk collection's `.file` resource to the staged destination, then perform the safe overwrite from ticket 005.
- Apply creation and modification timestamps during finalization where supported.
- Abort and clean up sessions after cancellation or definite permanent failure. Recognize that Nextcloud may expire inactive sessions.
- Fall back to streamed ordinary upload when chunking is unsupported or the file is below the threshold.
- Keep worker runs bounded so one huge file does not monopolize Android job time.

## Acceptance criteria

- A large fixture uploads and finalizes with the exact original bytes.
- Killing the process after several chunks causes a later run to resume at the first missing chunk.
- Reconciliation handles a locally recorded chunk missing remotely and a remote chunk missing locally.
- An expired upload session restarts cleanly without marking the job completed or losing the destination.
- Existing destinations remain untouched until finalization succeeds.
- Quota failure, invalid chunk size, missing local content, authentication failure, and server expiry produce correct retry or blocker states.
- Tests cover chunk naming, boundaries, checkpoint reconciliation, session expiry, and finalization.

## Verification

- Use an integration fixture large enough to span several chunks.
- Interrupt the network and kill the app at deterministic chunk boundaries.
- Compare the final remote hash and verify temporary sessions are cleaned up or tracked for later cleanup.

## Not in this ticket

- Parallel chunk transfer
- Generic WebDAV resumable uploads
- Per-server manual tuning
- Background notification UI

## Open question

**Question:** Which initial threshold and chunk size should we use before measurements exist?

**Default:** Start chunking at 20 MiB with 10 MiB chunks, cap values to server-advertised limits, and change them only after integration measurements justify it.
