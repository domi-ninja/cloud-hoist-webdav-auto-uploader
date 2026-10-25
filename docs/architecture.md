# Architecture and engine behavior

[README](../README.md) · [Development](development.md) · [Publishing](publishing.md)

## Ownership

Cloud Hoist connects directly to one Nextcloud account. It has no application backend. React Native renders the UI; Kotlin owns discovery, the durable queue, background scheduling, credentials, and transfers. Uploads continue without the JavaScript UI running.

| Location | Responsibility |
| --- | --- |
| [`src/app`](../src/app/) | Backups, Status, Settings, and upload-detail routes. |
| [`src/features`](../src/features/) | Connection forms, folder setup, previews, suggestions, and license notices. |
| [`src/lib/engine-query.tsx`](../src/lib/engine-query.tsx) | Snapshot queries, invalidation, and inventory pagination. |
| [`modules/webdav-upload-engine/src`](../modules/webdav-upload-engine/src/) | Native API wrapper, Zod schemas, and inferred TypeScript types. |
| [`modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine`](../modules/webdav-upload-engine/android/src/main/java/ninja/domi/cloudhoist/engine/) | Room, MediaStore/SAF discovery, WorkManager, and Nextcloud clients. |

## Upload lifecycle

1. MediaStore discovers indexed media folders. Android's folder picker grants access to custom directory trees through SAF. Adding a backup includes its existing files.
2. `SourceRevisionRecorder` records file identity, relative path, size, and timestamps in Room. Changed files create new revisions; unchanged revisions are deduplicated. Renames and moves upload to their new paths.
3. `EngineWorkScheduler` observes media changes and requests reconciliation every 15 minutes. Android chooses the actual execution time. Scheduled scans and upload claims skip disabled sources.
4. `QueueDrainRunner` claims one job at a time, oldest first, in bounded batches. Claims and attempts are durable, so interrupted work can be recovered.
5. Direct uploads stream into a temporary remote sibling, then move over the destination after transfer completion. Files of at least 20 MiB use Nextcloud chunked upload when server capabilities allow it; Room stores chunk checkpoints for resumption. Original media is read from its URI rather than copied into app storage.
6. Failures get an initial attempt plus three automatic retries with backoff. Exhausted failures become visible blockers and send a notification that opens that file's details. User pauses and normal worker interruptions do not consume this retry budget.

Global constraints default to unmetered networks and battery-not-low, with charging optional. Pause cancels upload work; Resume schedules it again. A disabled folder keeps its pending work but contributes nothing to overall progress or estimated remaining time.

Successful upload records are the completion receipts. Completed-folder counts deduplicate remote target paths, so editing and uploading the same file again does not increase the file count. Normal scans do not restore remotely deleted files. Removing a backup clears its queue and history, leaving phone and server files intact.

`PhoneUploadReadme` maintains `Read me - Cloud Hoist.txt` inside the configured backup root, initially `Phone Uploads`. When enabled pending work is finished, it writes the timestamp of the latest completed upload in that root. Metadata-write failures retry without re-uploading completed media.

## Native boundary and credentials

Native reads return snapshots or pages. TypeScript validates responses with Zod before exposing them to the UI. Commands return typed success/error unions. `onSnapshotInvalidated` carries a revision number; clients refetch instead of rebuilding native state from partial events.

Login uses Nextcloud Login Flow v2 or manual app credentials. `AndroidAccountRepository` encrypts the stored app password with AES-GCM using an Android Keystore key. Stored passwords are never returned in account summaries or events. Account validation rejects redirects, and certificate failures have no trust-all bypass.

The app has no analytics SDK or hosted crash reporter. Diagnostics stay local. Remote previews use a bounded thumbnail cache; local video frames are decoded into memory with Android's available codecs.

## File inventory

`FileInventory` joins current local revisions with a WebDAV listing. A parent destination excludes subfolders owned by another configured backup, including disabled backups, so a screenshot is not listed twice under both its parent and its own backup. Temporary upload objects are also excluded.

A server-only entry can still be valid after its phone copy is deleted, another client adds it, or Android no longer grants access to the local copy. Presence is shown with icons. The inventory does not turn server-only files into upload jobs.

## Destination changes

Room owns the backup root and a pending destination-change journal. Changing the root rebases every configured backup, including disabled ones, preserving each destination suffix. Legacy `/Cloud Hoist` and `/Phone Uploads` paths retain their suffix when repairing older preference-only root changes. A custom destination outside the former root keeps its complete path below the new root. The confirmation lists every old and new path before applying changes.

Individual destination browsing stops at the backup root and selects the exact folder. If a browsed path returns not found, the browser creates it and any missing parents, then reloads it once without asking the user. Existing paths need no creation requests. Permission, connection, and creation failures remain errors. The account root is never created by the browser.

Multiple backups can share a destination. Changing an existing destination offers moving known remote files or leaving them and uploading copies. Moves include current local files and tracked remote uploads, including archived files whose phone copy is gone. Uploading copies queues only files still present locally. Unknown remote files and empty old folders stay where they are.

Destination changes hold uploads and serialize against discovery and transfers without changing the user's pause setting. Each DAV MOVE uses the source ETag and `Overwrite: F`. For operations of up to 20 files, filename collisions trigger conditional downloads and streamed SHA-256 comparisons. Identical content keeps the destination and deletes the redundant source, with both file versions guarded by the DELETE request. Shared originals remain when another backup still uses them. Different content, unavailable comparisons, and operations over 20 files use the next free `name_1.ext`, `name_2.ext` filename. A destination created between lookup and MOVE triggers another lookup and retry, never an overwrite.

The journal records the selected filename and duplicate destination version before changing server files. Retry uses those records to recover lost MOVE, COPY, and DELETE responses. Renamed paths also update upload jobs and history. Network, permission, and changed-version failures retain progress. Reopening a destination editor resumes the existing operation; Settings can also resume it or leave the remaining originals and queue uploads. Switching to uploads first accounts for moves whose responses were lost, including remote-only archives.

Source paths, current jobs, the root, and completion commit together. That commit releases the upload hold even if the screen closes before acknowledging completion. Old chunk checkpoints are discarded when jobs change destinations.

Upload errors appear on the file row and its detail screen, including failures whose local file disappeared. DAV listing errors appear on the affected backup card. Picker and save errors remain visible in the backup editor.

## Application distribution

Builds default to the beta channel. `CLOUD_HOIST_CHANNEL=fdroid` embeds the F-Droid channel through Expo app config. Both retain the same package and signing identity. App code ships in complete APKs; EAS OTA and Play Store integration are absent. Beta and F-Droid artifacts have separate output directories so one cannot overwrite the other. Expo modules build from source, and license notices are available offline in Settings.

Settings caches successful update checks for one hour and supports manual refresh. Beta builds query GitHub's published release list and accept uploaded APKs from `beta-<year>-<minor>` or legacy `v<year>-<minor>` releases. Drafts, incomplete APKs, unexpected URLs, and F-Droid reference releases are excluded. Versions are compared numerically. The update button opens the exact GitHub APK URL in the browser. F-Droid builds query the public per-package API, prefer the published suggested version, and open F-Droid for installation. Failed checks replace earlier success messages; requests time out after fifteen seconds. The installed version appears here rather than About.

Backups shows up to two suggested folders, ranked by total size after excluding configured and hidden folders. Each card gives the path a full-width row above direct Hide suggestion and Start backup actions. Hiding a folder brings in the next eligible suggestion. Suggested folder cards move as one surface. A right swipe opens backup setup; a left swipe hides the suggestion and offers Undo. Hidden folders can be restored individually or together from the bottom of Backups. Thumbnail scrolling keeps priority over the card swipe.

Status opens images in an image-first file view. It reads local media first and falls back to an authenticated download of the original Nextcloud image if the local copy is unavailable. Credentials remain native. Remote images use a private cache capped at sixteen files and 64 MiB, with a 50 MiB per-image download limit and a thirty-second timeout. Failed, empty, or oversized downloads leave no partial files. Non-image files and upload failures retain labeled file details and retry controls.
