# 093 Make Activity a file inventory

Status: done

Parent: 037

Depends on: 004, 008, 091

## Outcome

Activity answers a concrete question per file: is it on the phone, on Nextcloud, or both? Images appear as thumbnails, recent files stay compact, and older entries can be expanded.

## Work

- Replace the event-first Recent activity list with one row per file known to a configured source and destination.
- Reconcile local discovery records with a WebDAV listing for each configured destination.
- Show local-only, Nextcloud-only, and both states with an icon over the thumbnail.
- Use the local content URI for a local thumbnail. Fetch a bounded server preview or thumbnail for Nextcloud-only images without downloading the original file into the UI.
- Use a plain file placeholder when a file is not an image or no thumbnail can be decoded.
- Keep queued, uploading, retrying, failed, and blocked state visible on the matching file row.
- Sort by the latest known local, remote, or transfer activity.
- Show the first 20 files by default and let the user expand and collapse the rest without dropping pagination.
- Keep refresh, Retry failed, blockers, and Clear completed history available. Clearing transfer history must not remove files from the inventory.
- Bound thumbnail dimensions, memory use, cache size, and parallel requests so a large source does not stall the screen or flood Nextcloud.
- Treat remote listing and preview failures as row or source-level errors. Keep local results visible.

## Acceptance criteria

- Activity shows one entry for a local-only file, one for a Nextcloud-only file, and one for a file present on both sides.
- Each state has a distinct accessible label and visible overlay icon.
- Supported images use thumbnails. Unsupported and failed previews use a stable placeholder.
- Transfer progress and failures attach to the relevant file instead of appearing as duplicate file rows.
- The initial view shows at most 20 file entries and exposes a clear way to show and hide more.
- Refresh updates local discovery, remote presence, and transfer state.
- Clearing completed history leaves the file inventory intact.
- A remote error does not hide local-only files.
- The screen remains responsive with hundreds of files and enlarged font scaling.

## Verification

- Add reconciliation tests for all three presence states, duplicate names across sources, transfer overlays, sorting, and clearing history.
- Add UI tests for the 20-item collapse, expansion, placeholders, errors, and accessible state labels.
- Run TypeScript, Expo lint, Jest, and native Android tests.
- Build and install the release APK.
- Verify mixed local and remote fixtures against a disposable Nextcloud folder, including enough files to exercise expansion and pagination.

## Not in this ticket

- Downloading Nextcloud-only files
- Editing or deleting files
- Full-screen image viewing
- Content-based duplicate detection
- Video playback

## $grilling

❓ **Q1** - **Is Activity history or current inventory?**: Ticket 037 calls it upload history but also asks to show every local and server image. Deleted files make those two models disagree.

➡️ Make the main list a current inventory. Keep the latest transfer result and timestamp on each row instead of retaining a permanent row for a file that exists nowhere.

❓ **Q2** - **What identifies the same file on both sides?**: A basename can collide when multiple local folders share one remote destination.

➡️ Match through the source's recorded upload identity and destination path. Use path matching only for remote files that have no local ledger record.

❓ **Q3** - **What does Show more expand?**: Expanding every remaining item at once is simple but can be huge.

➡️ Reveal the next page of 20 and keep the control available until all loaded pages are visible.
