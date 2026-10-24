# Beta, production, and Google Play release plan

This is the proposed release process for Cloud Hoist. It has not been implemented. Beta users install APKs from GitHub, production users install through Google Play, and both receive compatible JavaScript updates through hosted EAS Update.

## App variants

Use one codebase with two installed variants and two EAS channels.

| Variant | Android package | EAS channel | Native distribution |
| --- | --- | --- | --- |
| Cloud Hoist Beta | `ninja.domi.cloudhoist.beta` | `beta` | Signed APK on GitHub Releases |
| Cloud Hoist | `ninja.domi.cloudhoist` | `production` | Android App Bundle through Google Play |

The variants can coexist and have separate accounts, settings, queues, and history. Give beta a distinct app name and icon. Beta testing should use test-owned local and remote folders, preferably with a separate Nextcloud test account. Separate app installations can still change the same server files if configured to use them.

Existing installations already use the production package ID. Preserve their signing identity and local data. Ship an in-place update that moves them onto the production configuration. The new beta app installs alongside them and requires its own setup. Do not uninstall or clear existing installations during this transition.

Keep the beta and production JavaScript environments identical where possible. Read distribution behavior from the installed variant's native configuration so that a promoted JavaScript bundle cannot turn production into beta.

See [Expo's app variant guide](https://docs.expo.dev/build-reference/variants/).

## Choosing the update type

| Change | Release path |
| --- | --- |
| Screens, styling, text, assets, compatible JavaScript logic | EAS Update |
| Kotlin, upload workers, Room schema, permissions, native dependencies or configuration | Native release |
| Expo or React Native upgrade | Native release |
| JavaScript and native changes together | Native release |

Use Expo's `appVersion` runtime policy initially. A binary with version `2026-6` receives only OTA updates targeting runtime `2026-6`. Any native change requires a new version and runtime.

CI must compare native inputs with the recorded build for the target runtime and reject OTA publication if they differ. Include custom native modules, dependency and lockfile changes, build plugins, and native configuration in that check. Treat uncertain compatibility as requiring a native release.

Keep `app.json` as the base release identity. Add a thin dynamic configuration layer for variant-specific package IDs, names, icons, update channels, and distribution settings.

### Versioning

The existing version rules need an explicit adjustment for OTA releases:

- Native releases keep `year-minor`, such as `2026-6`.
- Android versionCode remains year × 10000 + minor, such as `20260006`.
- The package.json tooling version remains `2026.6.0` for that native release.
- OTA releases keep the native version and receive a separate update identity, such as `2026-6 · update 3`.
- Record the EAS update ID, target runtime, and source commit for each OTA release.

Settings should show the installed native version and OTA revision. Diagnostics should include the exact EAS update ID and commit. Publishing JavaScript must not change the reported installed Android versionCode used by the native update checker.

See [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/).

## OTA release process

1. Run relevant automated checks.
2. Publish the update to the `beta` channel for the intended runtime.
3. Test on the physical phone using the beta APK with the same runtime as the production version being patched. A newer native beta does not validate an update for an older production runtime.
4. Verify affected controls, restart behavior, offline startup, and retained accounts, settings, queues, and history. For upload changes, verify downloaded file hashes.
5. Promote the tested update to `production` by republishing the existing bundle rather than exporting another bundle.
6. Download updates quietly and activate them on the next normal launch. Do not force a reload during an open destination change.
7. Retain the previous working update and a documented rollback command. An OTA rollback does not undo server changes or data migrations.

Reusing the tested bundle requires matching runtime compatibility, JavaScript environment variables, and update-signing configuration across the two channels. Validate that configuration before enabling promotion. Use staged production rollouts once there are enough users to make them useful.

See [EAS deployment and promotion](https://docs.expo.dev/eas-update/deployment/).

## Native release process

1. Assign the next native version and runtime.
2. Build a signed beta APK and a production `.aab` from the same commit. Record their checksums and build configuration.
3. Test the beta APK on the physical phone, then publish that exact APK to GitHub Releases.
4. Upload the production AAB to Google Play's internal testing track.
5. Install through Play and test the delivered production build. Cover existing-install upgrades, account retention, backup settings, queue and history retention, uploads, background work, and update delivery.
6. Promote the same uploaded AAB to production after testing and any required review. Do not rebuild between testing and promotion.

The beta APK and production AAB are different artifacts. Beta retains the existing rule to test and publish the same signed APK. Production gets the equivalent rule to test the Play-delivered build and promote the same uploaded AAB.

## Release automation and update UI

- Ordinary pushes run checks and do not publish releases.
- Provide explicit actions for beta OTA publication, production OTA promotion, beta APK publication, and production AAB submission.
- Require an explicit release decision before production publication. Automating an upload must not automatically approve public rollout.
- Record commit, runtime, variant, version, artifact checksum, and EAS update ID where applicable.
- Keep APK updates in place and preserve existing signing keys. Retry failed uploads using the existing tested artifact.
- Beta offers GitHub APK downloads. Production uses Google Play for native updates.
- Replace the global `appIsInStore` flag with variant-specific behavior. Production must not offer beta APKs.
- Keep hosted EAS Update independent of the native build provider. Existing local builds can remain; adopting EAS Build is optional.

## Google Play launch roadmap

### 1. Create or verify the developer account

Start this work immediately. Choose the appropriate personal or organization account and complete Google's verification. Account type and creation date determine the applicable testing requirements.

### 2. Set up signing and preserve existing installs

Enroll in Play App Signing and supply the existing app signing key so that current sideloaded installations can upgrade to the Play version. Create a separate upload key for future submissions. Keep encrypted backups of the existing signing material.

Before launch, verify an actual sideloaded-to-Play upgrade on the physical phone without uninstalling or clearing data.

See [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756).

### 3. Implement the release foundations

Add `expo-updates`, variant configuration, the `beta` and `production` channels, runtime compatibility checks, production AAB builds, and the release actions described above. Ship the initial native update needed to enable OTA delivery.

Update the release and testing rules in AGENTS.md and the existing guides when implementing this process. Keep ongoing release instructions in [docs/publishing.md](docs/publishing.md).

### 4. Prepare the listing and reviewer access

Prepare screenshots, app descriptions, a support contact, privacy policy, content rating, target audience, advertising declarations, and Data safety information.

Review actual data flows before filling out the declarations. Include uploads to the user's chosen Nextcloud server, EAS update requests, and third-party SDK behavior. Do not infer that the app collects no data solely because it has no analytics SDK.

Provide reviewers with a working Nextcloud test account and concise steps to connect, configure a backup, upload files, and inspect results. Keep reviewer credentials private and maintain that account during review.

See [Google Play Data safety requirements](https://support.google.com/googleplay/android-developer/answer/10787469).

### 5. Address permission reviews early

The app currently requests broad photo and video access and uses a `dataSync` foreground service.

Prepare the media-access declaration around the core need for persistent access to automatically back up media. Explain why selecting individual photos is insufficient for that feature. Approval is subject to Google's review.

Prepare the foreground-service declaration and demonstration video. Show how users start or enable backups, see an accurate upload notification, and stop or pause work. Check the implementation against current background-execution restrictions before submission.

Sources: [photo and video permissions](https://support.google.com/googleplay/android-developer/answer/14115180) and [foreground service declarations](https://support.google.com/googleplay/android-developer/answer/13392821).

### 6. Run Play testing and apply for production access

Start with internal testing of the production package and AAB. Complete any closed-testing requirements that apply to the developer account.

As checked on October 24, 2026, personal accounts created after November 13, 2023 require at least 12 testers opted into a closed test continuously for at least 14 days before applying for production access. Meeting that threshold allows an application for access; it does not guarantee immediate approval.

Sideloaded beta APKs do not replace Google's closed test. Recruit the required Play testers early if this requirement applies.

See [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).

### 7. Submit and launch

Upload the production AAB through Play Console initially. EAS Submit can automate later submissions once service-account access is configured. New Play apps require Android App Bundles rather than APK uploads.

Complete review, verify the public installation and update path, and monitor feedback. Use Play's staged rollouts for subsequent native updates and beta-to-production EAS promotion for compatible OTA updates.

See [Android submission with EAS](https://docs.expo.dev/submit/android/).

## Implementation order

1. Begin developer-account verification and identify whether the closed-test requirement applies.
2. Establish production signing continuity and the beta package identity.
3. Implement variants, EAS Update, runtime checks, and release automation.
4. Validate OTA delivery, rollback, and native upgrade paths on the physical phone.
5. Prepare the listing, privacy disclosures, permission declarations, and reviewer account.
6. Run Play internal testing and any required closed test.
7. Apply for production access where required, complete review, and launch.
