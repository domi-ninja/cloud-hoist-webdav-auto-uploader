# Publish Android releases

[Back to README](../README.md) · [Development](development.md)

## GitHub releases

The private repository on `git.domi.ninja` is the primary upstream. The public
[GitHub mirror](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader)
builds an APK on each push to `main`. The Android release workflow can also be
started manually from the Actions tab.

This checkout sends `git push origin main` to both upstreams. In another checkout,
add the GitHub remote and push both explicitly:

```sh
git remote add github git@github.com:domi-ninja/cloud-hoist-webdav-auto-uploader.git
git push origin main
git push github main
```

After merging a PR on the private server, pull its `main` before pushing it to
GitHub. A merge on the private server alone does not start GitHub Actions.

The workflow runs TypeScript, lint, JavaScript, release-script, and native unit
checks. It builds with the existing private signing key, verifies the signature,
and publishes an APK, `SHA256SUMS`, and `update.json` to GitHub Releases. Build
numbers start above 1000 and always exceed the last published build, including
workflow reruns. The APK and update manifest remain available as Actions artifacts
for 30 days. GitHub release assets remain available until someone removes them.

The GitHub repository needs two Actions secrets. Use the existing `.signing/`
files so updates retain the same signing identity:

```sh
base64 -w0 .signing/release.p12 | gh secret set ANDROID_RELEASE_KEYSTORE_BASE64 --repo domi-ninja/cloud-hoist-webdav-auto-uploader
gh secret set ANDROID_RELEASE_SIGNING_JSON --repo domi-ninja/cloud-hoist-webdav-auto-uploader < .signing/release.json
```

Do not upload signing files or Nextcloud credentials as source or release assets.

## Update destination

`release.config.json` contains the public GitHub repository and the boolean
`appIsInStore` flag. Keep it `false` until the app is published on Google Play.

With the flag off, the update action opens the new signed APK. With it on, the app
checks whether Google Play can handle the configured Android package and opens
that exact store listing. Devices without a working Play Store fall back to the
APK. The app name and package come from `app.json`; a display name is not a unique
Google Play identifier.

The app checks on launch, when returning to the foreground after an hour, and
every six hours while open. Settings has a manual check. Dismissing an update
suppresses its prompt for the current app session. The update feed accepts only
newer builds for the configured Android package and APK URLs in this GitHub
repository. Android retains control of installation approval.

## Private beta signing

Run `pnpm android:signing` once to create the private release key. It refuses to
overwrite an existing `.signing/` directory. Back up the entire directory securely
in a password manager or encrypted offline storage. It contains both the keystore
and its password, is owner-only, and is ignored by Git. Losing it prevents signing
compatible updates. Never share it with testers.

Run `pnpm android:beta` to generate the Android project, build and verify the signed
APK, and copy it to `dist/cloud-hoist-beta.apk`. Share only that APK.
The command never installs or uninstalls anything on connected devices.
For a manually distributed local build, set `expo.android.versionCode` in
`app.json` above the latest published build. Update `expo.version` for a new
visible version. GitHub Actions assigns its build number automatically.

Only this beta command applies the private signing configuration. Ordinary local
Gradle/test builds retain the debug key so device tests remain compatible. Do not
distribute their APKs. A beta cannot update an existing debug-signed installation;
switching requires uninstalling it first, which removes app settings and history.
Future beta updates use the same private key and can install over the previous beta.

## Optional Nextcloud distribution

Run `pnpm android:publish` to build locally, sign with the existing key, and upload
to Nextcloud. The command needs no phone connection.

One-time setup:

1. Complete the [development setup](development.md#first-setup) and ensure `.signing/release.json` and
   `.signing/release.p12` exist. Reuse the existing signing key for subsequent releases. Keep an encrypted backup.
2. Choose a dedicated beta folder in Nextcloud. The script creates it if missing;
   its parent must already exist. Give testers a read-only,
   password-protected folder share. The script does not create or change shares.
3. Set these variables in the repository's `.env`. Use the actual URL-encoded
   WebDAV account root, not the tester share link. Use a dedicated
   Nextcloud app password, preferably for an account limited to this folder.

```dotenv
NEXTCLOUD_WEBDAV_URL="https://cloud.example.com/remote.php/dav/files/username"
NEXTCLOUD_USERNAME="username"
NEXTCLOUD_PASSWORD="YOUR-NEXTCLOUD-APP-PASSWORD"
NEXTCLOUD_DIRECTORY="beta_apps"
```

Protect that file with `chmod 600 .env`. Both `.env` and the `.signing/`
directory are ignored by Git. Never send these credentials or the signing key to testers.
Existing shell environment variables take precedence over `.env`. Directory names
are encoded automatically; use normal folder names in `NEXTCLOUD_DIRECTORY`.

Each `pnpm android:publish` run checks the destination, increments
`expo.android.versionCode` in `app.json` above both its current value and the
latest GitHub build, builds and verifies the APK signature,
uploads a unique temporary file, downloads it to verify SHA-256, and renames it to
`cloud-hoist-<version>-<YYYY-MM-DDTHHmmssZ>-build-<versionCode>.apk` without replacing an existing beta.
For example, `cloud-hoist-0.1.0-2026-10-03T195219Z-build-2.apk`. The date and time are
UTC, taken from the local APK's modification time so upload retries keep the same name.
Keep and commit the version bump, even after a failed build/upload. Use this one
checkout for publishing, or synchronize `app.json` before publishing elsewhere.
Update `expo.version` manually when you want a new user-visible version label.
Both beta build commands compile the beta label into the app. Settings → About
shows `Beta 0.1.0 · Build 2`, using the version and build number from Expo's bundled
app configuration. Other builds show `Version` instead of `Beta`.

The local APK remains at `dist/cloud-hoist-beta.apk`. On failure the command
exits nonzero and attempts to remove only its own temporary upload. It never deletes
previous betas. Refused connections are retried up to three times with short backoff;
other failures stop the command. Nextcloud reserves `.part`, so staging uses a unique
`.beta-<UUID>.apk` filename.
A lost response to the final rename may mean publication succeeded;
check the remote folder before retrying. Old versions remain for manual cleanup.
If the process is killed, check that no build is still running before removing the
empty `dist/.beta-build-lock` directory with `rmdir dist/.beta-build-lock`.

Nextcloud distribution is manual; in-app update checks use GitHub Releases.
Testers open the shared folder, download the highest-numbered APK, and approve the
Android update. `pnpm android:beta` builds locally without uploading or
incrementing the version. `pnpm test:publish` tests the upload protocol with a fake
server, without touching Nextcloud.
