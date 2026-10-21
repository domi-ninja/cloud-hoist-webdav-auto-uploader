# Cloud Hoist

An Android app that automatically uploads photos, videos, and selected folders to Nextcloud. This is an independent project, unaffiliated with Nextcloud GmbH.

## Get started

Download the current beta from [GitHub Releases](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/latest). There is no Google Play release yet.

1. Download the `.apk` file from the latest release and open it on your Android phone. Allow installation from that source if Android asks.
2. Open Cloud Hoist, enter your Nextcloud server URL, and sign in through your browser. You can also connect with your username and a Nextcloud app password.
3. Add a backup folder. Choose Camera, Screenshots, or a local folder, grant access when prompted, and check the destination in Nextcloud. Tap Save backup folder.
4. Check Status for upload progress and errors. Check Settings if uploads are waiting for network or power conditions.

Adding a source includes its existing files. Choose a small folder first if you want to try the app before starting a larger backup.

Cloud Hoist uses a new Android application ID. It installs separately from earlier betas under the previous name; sign in and add your backup folders again. Disable uploads in the old app before enabling the same folders in Cloud Hoist. Existing files on your server stay in place. New backup folders default to `/Phone Uploads`; select an existing destination if you want to keep using it.

The app checks for newer builds and offers an update when one is available. You can also use Settings → App updates → Check for updates, or download the latest APK from GitHub. Android asks you to approve installation. Updates signed with the same key keep your settings and history. Switching from a development build to a beta requires uninstalling the development build first, which removes its settings and history.

## Developer docs

- [Set up, run, and test the app](docs/development.md)
- [Build, sign, and publish a beta](docs/publishing.md)
- [Product decisions](PLAN.md)
- [Project tracking](docs/tickets/README.md)

## License

Cloud Hoist is licensed under GPL-3.0-or-later. Third-party packages and retained scaffold assets keep their respective licenses.
