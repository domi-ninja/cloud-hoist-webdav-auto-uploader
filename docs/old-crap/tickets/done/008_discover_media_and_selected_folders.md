# 008 Discover media and selected folders

Status: done

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

- Source-classification, Android permission-branch, tree traversal, revision-detection, and Room transaction tests pass in the native unit suite.
- The complete Android instrumentation suite passes on the API 36 / Android 16 emulator. Its MediaStore fixture verifies Camera and Screenshots classification without body reads; its document-provider fixture verifies nested SAF traversal.
- The installed React Native app requests media access only after its explanation and returns from Android's full-access prompt with a Camera preview.
- The installed app selected `Download/AutoUploadAcceptance` through the system folder picker and previewed a nested 35,149-byte fixture as one eligible file.
- The selected tree's prefix grant remained present after both app process death and a full emulator reboot.
- Room emulator tests verify new-files-only baselines, include-existing queue order, modified-file requeueing, and recoverable source blockers without deleting source or queue state.
- The merged release manifest declares scoped media permissions and contains neither `MANAGE_EXTERNAL_STORAGE` nor any fixture provider.

## Not in this ticket

- Near-immediate scheduling
- iOS or web file access
- Date-based destination folders
- Content hashing or move detection

## Open question

**Question:** Should arbitrary SAF sources include hidden dotfiles and `.nomedia` files?

**Default:** Include ordinary dotfiles because the user selected the whole tree, but skip `.nomedia` itself because it is Android control metadata rather than user content.
