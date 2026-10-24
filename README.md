# Cloud Hoist

An Android app that uploads selected phone folders to Nextcloud. Independent from Nextcloud GmbH. Requires Android 10 or newer and one Nextcloud account.

## Get started

F-Droid packaging is in progress. Cloud Hoist is not yet listed in the main F-Droid repository. Existing installations can continue using their configured backups; keep them installed to preserve local settings and history. Developers can build a local validation APK using the [development guide](docs/development.md).

Once the F-Droid listing is available:

1. Install Cloud Hoist through F-Droid.
2. Enter your Nextcloud server address and sign in through the browser. You can also use a Nextcloud app password.
3. Tap **Start backup** on a suggested folder, or **Choose other directory to back up** below the suggestions. Grant access, check the destination, and tap **Save backup folder**.
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

F-Droid manages app updates. Cloud Hoist does not check external release feeds or download code. Migration of existing GitHub installations depends on preserving the signing identity; do not uninstall or clear app data to resolve an update mismatch.

## Developer docs

- [Development and testing](docs/development.md)
- [Architecture and engine behavior](docs/architecture.md)
- [F-Droid releases](docs/publishing.md)
- [Agent guidance](AGENTS.md)

## License

[GPL-3.0-or-later](LICENSE). Dependencies and retained scaffold assets keep their [third-party notices](THIRD_PARTY_NOTICES.md).
