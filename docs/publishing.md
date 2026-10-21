# Build and publish a beta

[README](../README.md) · [Development](development.md) · [Architecture](architecture.md)

## Version and signing

Use `year-minor` for each changed release bundle, for example `2026-3`. Set these together:

| File | Value for that example |
| --- | --- |
| `app.json` → `expo.version` | `2026-3` |
| `app.json` → `expo.android.versionCode` | `20260003`, calculated as year × 10000 + minor |
| `package.json` → `version` | `2026.3.0` |

Increment the minor number for the next changed bundle. Start at 1 in a new year. Retry failed uploads with the existing artifact. Rebuild only to correct a failed build or test. Documentation-only changes do not create an app release.

Reuse `.signing/release.p12` and `.signing/release.json`. Keep an encrypted backup of both; losing the key prevents compatible updates. They are ignored by Git and must never become source or release assets. `pnpm android:signing` creates a key only for the first release and refuses to replace an existing signing directory.

## Build and test once

Run the [development checks](development.md#checks-without-a-device), then:

```sh
pnpm android:beta
ANDROID_SERIAL=YOUR_PHONE_SERIAL pnpm android:install
```

The first command builds, signs, and verifies `dist/cloud-hoist-beta.apk`. The second verifies its signing key, installs it in place on the selected physical phone, and launches it without clearing app data. Follow the [phone validation procedure](development.md#phone-validation). Publish that tested APK.

The private `git.domi.ninja` repository is the primary upstream; GitHub hosts public source and APKs. This checkout pushes `origin` to both. Check `git remote -v` in other checkouts and push both remotes explicitly if needed. Commit the tested code and version, then push `main` before creating the release.

## Publish the tested APK

Set release identity from the checkout and package the existing APK:

```sh
RELEASE_REPO=$(node -p 'require("./release.config.json").githubRepository')
RELEASE_VERSION=$(node -p 'require("./app.json").expo.version')
RELEASE_SHA=$(git rev-parse HEAD)
GITHUB_REPOSITORY="$RELEASE_REPO" GITHUB_SHA="$RELEASE_SHA" node scripts/android/github-release.mjs package
```

Edit `dist/github/release-notes.md` to describe the changes and validation, then publish:

```sh
gh release create "v$RELEASE_VERSION" \
  "dist/github/cloud-hoist-$RELEASE_VERSION.apk" \
  dist/github/update.json dist/github/SHA256SUMS \
  --repo "$RELEASE_REPO" --target "$RELEASE_SHA" \
  --title "Cloud Hoist $RELEASE_VERSION" \
  --notes-file dist/github/release-notes.md --latest
git tag "v$RELEASE_VERSION" "$RELEASE_SHA"
git push origin "v$RELEASE_VERSION"
```

Verify the public APK against `SHA256SUMS` and confirm `releases/latest/download/update.json` identifies the same version, package, and APK. If publication fails after upload, inspect the release before retrying. Do not assign a new version just to retry publication.

## GitHub Actions

The [Android release workflow](../.github/workflows/android-release.yml) runs on `v20*-*` tags or manual dispatch. Ordinary `main` pushes do not release. An existing GitHub release causes the build job to be skipped, including when the locally tested APK was published before pushing its tag.

For an unpublished version, the workflow checks the app and release logic, tests the native engine, builds with the private signing key, verifies the signature, and publishes the APK, checksum, and update manifest.

Configure these repository secrets from the existing signing files:

```sh
base64 -w0 .signing/release.p12 | gh secret set ANDROID_RELEASE_KEYSTORE_BASE64 --repo "$RELEASE_REPO"
gh secret set ANDROID_RELEASE_SIGNING_JSON --repo "$RELEASE_REPO" < .signing/release.json
```

## In-app updates

`release.config.json` selects the GitHub repository and `appIsInStore`. Keep the flag false for APK distribution. When true, devices with Google Play open the configured Android package's store listing; other devices use the APK. The app accepts only newer version codes for its own package and APK URLs in the configured repository. Android controls installation approval.

## Optional Nextcloud distribution

`pnpm android:publish` builds a signed APK and uploads it to a dedicated Nextcloud beta folder. Configure `NEXTCLOUD_WEBDAV_URL`, `NEXTCLOUD_USERNAME`, `NEXTCLOUD_PASSWORD`, and `NEXTCLOUD_DIRECTORY` in ignored `.env`. The URL must be the account's DAV root; the target folder's parent must already exist. Use an app password and protect `.env` with `chmod 600 .env`.

The publisher verifies the uploaded checksum and renames its temporary file without replacing existing betas. It does not increment versions. In-app update discovery still uses GitHub Releases.

An interrupted build can leave `dist/.beta-build-lock`. Confirm no build is running before removing that empty directory with `rmdir`.
