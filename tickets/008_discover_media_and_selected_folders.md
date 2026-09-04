# 008 Discover media and selected folders

Status: blocked by 006

Depends on: 002, 006

## Outcome

Users can configure Camera, Screenshots, and arbitrary folder sources. The Kotlin engine discovers eligible files, persists revisions in the Room queue, and reports lost access without requesting all-files permission.

## Work

- Define source records for MediaStore presets and Storage Access Framework document trees.
- Discover Camera and Screenshots through MediaStore bucket or relative-path data rather than hard-coded absolute filesystem paths.
- Handle the storage permission branches for Android 10 through current Android, including partial photo and video access on Android 14 and newer.
- Do not declare or request `MANAGE_EXTERNAL_STORAGE`.
- Launch `ACTION_OPEN_DOCUMENT_TREE` for arbitrary folders and persist the granted read permission.
- Traverse the selected document tree without assuming a direct filesystem path. Upload any readable non-directory file type.
- Produce a source preview with eligible file count and total size before the source becomes active.
- If the user chooses new files only, record a baseline without queueing current revisions. If they include existing files, queue those revisions oldest first.
- Keep media destinations flat. Preserve relative subfolders under an arbitrary selected tree.
- Detect missing MediaStore permission, revoked SAF grants, deleted folders, removed storage, and unreadable documents. Mark the source blocked without deleting it or its existing queue.
- Treat a moved or renamed document as new. Requeue the same provider identity only when size or modification time changes.

## Acceptance criteria

- Camera and Screenshots presets find the expected media on each supported Android permission branch.
- A selected SAF tree survives process death and reboot through its persisted URI grant.
- Arbitrary nested files retain their relative remote paths.
- New-files-only setup creates no upload jobs for the initial scan. Include-existing setup creates the expected jobs and size total.
- A revoked permission or removed folder produces a recoverable source blocker.
- Scans never read file bodies to calculate identity hashes.
- The manifest contains no all-files permission.
- Tests cover empty folders, deep trees, duplicate filenames in different subfolders, missing timestamps, inaccessible documents, and modified files.

## Verification

- Run source-classification and revision-detection unit tests.
- Exercise Camera, Screenshots, and SAF sources on the emulator with seeded fixtures.
- Revoke permissions and remove a selected directory, then confirm the configuration remains and shows the correct recovery action.

## Not in this ticket

- Near-immediate scheduling
- iOS or web file access
- Date-based destination folders
- Content hashing or move detection

## Open question

**Question:** Should arbitrary SAF sources include hidden dotfiles and `.nomedia` files?

**Default:** Include ordinary dotfiles because the user selected the whole tree, but skip `.nomedia` itself because it is Android control metadata rather than user content.
