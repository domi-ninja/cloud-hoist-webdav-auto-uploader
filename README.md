# Cloud Hoist

An Android app that uploads selected phone folders to Nextcloud. Independent from Nextcloud GmbH. Requires Android 10 or newer and one Nextcloud account.

## Get started

Download [Cloud Hoist 2026-11 beta](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/beta-2026-11/cloud-hoist-2026-11.apk), or see [GitHub Releases](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases) for all versions. Install the signed APK over an existing installation to keep accounts, settings, and history. F-Droid packaging is in progress; the app is not listed there yet.

1. Download and install the latest beta APK. Android may ask you to allow installation from your browser.
2. Enter your Nextcloud server address and sign in through the browser. You can also use a Nextcloud app password.
3. Tap **Start backup** on a suggested folder or swipe it right. For another folder, tap **Choose other directory to back up** below the suggestions. Grant access, check the destination, and tap **Save backup folder**.
4. Open **Status** to see backed-up folders, progress, and failed files. Network and power rules are in **Settings**.

All existing files in a selected folder are included. Start with a small folder if you want to try the app first.

## Backup behavior

- New backups default to `/Phone Uploads`, followed by the local parent and folder names. Change the destination during setup or the upload root in Settings. The root contains a readme with the last completed upload timestamp.
- Changing the upload root updates every backup destination while keeping custom subpaths. Destination changes offer moving existing files or uploading copies. Multiple backups can share the same remote folder.
- Local edits upload again and replace destination files by default. Originals stay on the phone. Deleting a phone file keeps its uploaded copy; deleting a server copy does not automatically upload an unchanged local file again.
- Uploads wait for an unmetered connection and sufficient battery by default. Charging is optional. Android can delay background work; Status reports the current reason.
- Pause stops uploads globally. A folder switch controls that folder. Disabled folders are excluded from overall progress. Removing a backup folder removes its queue and history, without deleting phone or server files.

This is one-way upload. Generic WebDAV servers and Nextcloud end-to-end encrypted folders are unsupported.

## Updates

Beta builds check GitHub Releases, including beta prereleases. Settings shows the installed version and offers **Download update** when a newer APK is available. The browser downloads the APK; Android handles installation and verifies the existing signing identity. Production builds will install and update through F-Droid after the app is accepted there. Each build checks only its own update source. Failed checks are shown as errors. Never uninstall or clear app data to resolve an update mismatch.

## Developer docs

- [Development and testing](docs/development.md)
- [Architecture and engine behavior](docs/architecture.md)
- [Beta and F-Droid releases](docs/publishing.md)
- [Agent guidance](AGENTS.md)

## License

[GPL-3.0-or-later](LICENSE). Dependencies and retained scaffold assets keep their [third-party notices](THIRD_PARTY_NOTICES.md).
