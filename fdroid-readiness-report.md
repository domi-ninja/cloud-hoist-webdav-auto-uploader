# F-Droid readiness report

Audited on October 24, 2026, against commit `c548a1f409ff358a74e87ffc3ad2418faeb98045` and release `2026-6`.

## Verdict

No. Cloud Hoist is a plausible candidate for the main F-Droid repository, but we cannot claim that it meets every requirement or is ready to submit as-is.

The public GPL source, release tags, and preliminary scans are in place. No known non-free classes were reported in the published APK. The remaining work is an F-Droid build recipe, a complete dependency and notice review, external-update consent handling, submission metadata, and evidence for the project's maturity exception. Preserving upgrades from existing GitHub installations also requires a signing decision.

This audit changed no application code, update settings, or installed app data. It did not rebuild the APK. A successful scan is not an F-Droid approval.

## Requirements and evidence

| Area | Status | Repository evidence |
| --- | --- | --- |
| Public source and free software license | Meets the basic requirement | GitHub repository is public; `LICENSE` contains GPL v3; `package.json` specifies `GPL-3.0-or-later`. |
| Free dependencies and build tools | Preliminary checks pass; full review incomplete | JavaScript license inventory and APK scanner found no confirmed non-free dependency. Native library provenance still needs review. |
| Buildable from published source | Local builds work; F-Droid build unproven | Source and lockfile are tracked. Generated Android project is ignored. No F-Droid recipe or isolated F-Droid build exists. |
| Functional, maintained app | Supported by existing evidence | Recent commits, six release tags, and documented physical-phone validation exist. This audit did not repeat functional tests. |
| Useful, independently developed functionality | Supported; maintainer judgment remains | The repository implements its own folder discovery, native upload engine, and destination-change workflow. It is not just a renamed upstream APK or website wrapper. |
| Project maturity | Review-dependent | History starts September 4, 2026, less than three months before this audit. Existing-user evidence would be needed for the applicable exception. |
| Distinct application identity | Configured; maintainer review remains | Package is `ninja.domi.cloudhoist`; repository and project infrastructure use the corresponding `domi.ninja` naming. Global uniqueness and domain ownership were not independently certified. |
| Asset licenses and notices | Incomplete review | Editable logo source and generator are tracked. Bundled fonts were identified; the project's third-party notices cover only the Expo template. |
| External executable updates | Consent wording needs attention | GitHub APK download requires a user action, but the prompt does not explain bypassing F-Droid verification. EAS OTA is currently disabled. |
| Developer API keys and mandatory proprietary services | No requirement found in the app source | Users supply their own Nextcloud server and credentials. No developer API key is needed for backup functionality. GitHub is used for update checks. |
| Submission information | Not prepared | No tracked F-Droid recipe, Fastlane metadata, localized listing, screenshots, or per-version listing changelog was found. GitHub Issues is enabled. |
| Original developer's signature | Not established for F-Droid | Existing APK is signed, but no reproducible F-Droid rebuild has been demonstrated. This is not a general inclusion requirement. |

The governing source is F-Droid's [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/). Packaging and listing guidance comes from its [submission guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/).

## Checks performed

### Published APK

Inspected the existing signed `dist/cloud-hoist-beta.apk`, previously published as `2026-6`:

```text
Package:       ninja.domi.cloudhoist
Version:       2026-6
Version code:  20260006
SHA-256:       6a920fd2fc35ad21ae7d4b699108c27df16a3c45ae5dc7528c9c6d4f681c6caf
```

`apksigner verify --verbose --print-certs` succeeded. The manifest contains media, notification, networking, and background-transfer permissions. It does not request the advertising ID, overlay, all-files-access, or package-installation permissions. No debug acceptance provider was found. No signing-key, test-credential, or environment filenames were found in the APK file list; that filename check is not a complete secret scan.

Installed fdroidserver `2.4.5` in an isolated, ignored audit environment and ran:

```sh
fdroid scanner --refresh --exit-code ../../dist/cloud-hoist-beta.apk
```

The scanner exited successfully with no reported findings. It checked DEX classes against known non-free signatures and checked for unexpected APK signing blocks. This does not prove the freedom or provenance of every native library, JavaScript dependency, or asset.

### Source and dependencies

Exported the tracked commit with `git archive` and ran fdroidserver's source scanner against that export. It returned zero errors and zero warnings. This scan excluded ignored `node_modules`, generated Android files, credentials, and build output. It therefore does not replace scanning the fully prepared source tree from an actual F-Droid recipe.

`pnpm licenses list --prod --json` reported 614 dependency entries. All reported recognized open-source license expressions, including MIT, Apache-2.0, ISC, BSD, MPL-2.0, and CC-BY-4.0. None reported an unknown or explicitly proprietary license. These are package declarations, not an independent verification of every file or redistribution obligation. Some production dependencies are build tooling rather than code shipped in the APK.

Generated the Gradle `releaseRuntimeClasspath` dependency report successfully. No `com.google.android.gms`, Firebase, Crashlytics, Sentry, AppsFlyer, or Adjust coordinates were found. Google Maven and Google-named open-source artifacts are not by themselves evidence of a prohibited proprietary dependency.

The release graph includes Expo development-client/menu projects and `expo-updates-interface`. Their presence alone is not a policy failure. Review what they contribute to the prepared source and final release rather than assuming that every Expo component is either permitted or prohibited.

Backup traffic uses the user's chosen Nextcloud server. `ServerUrlNormalizer.kt` enforces HTTPS. No mandatory proprietary backup backend was found. This was source and artifact inspection, not a complete network-traffic or privacy audit. F-Droid maintainers must still assess any applicable anti-feature declarations, including external update behavior.

The APK contains React Native, Hermes, Expo, image-processing, and other native shared libraries. The JavaScript license list and DEX scan do not fully audit those binaries. F-Droid's recipe must establish acceptable source or dependency provenance. Do not treat every prebuilt component as an automatic rejection; the policy has specific allowances, including Hermes.

### Fonts and artwork

Matched the APK's two font files byte-for-byte to installed dependencies:

- `res/Ry.ttf` is `MaterialSymbols_400Regular.ttf` from `@expo-google-fonts/material-symbols`. The installed package includes the font's Apache-2.0 license.
- `res/cT.ttf` is `MaterialCommunityIcons.ttf` from `@expo/vector-icons`' vendored font collection. The upstream Material Design font collection identifies its fonts as Apache-2.0. Verify the exact bundled revision and retain the applicable notices before submission. See the [upstream license](https://github.com/Templarian/MaterialDesign/blob/master/LICENSE).

The app logo has an editable SVG and a deterministic generator in the repository. `THIRD_PARTY_NOTICES.md` currently documents the Expo template only. Expand the notice inventory for shipped code and fonts, and verify attribution requirements. This audit found a review and documentation gap, not proof that the fonts are proprietary.

## Current update behavior

EAS OTA means downloading a new JavaScript bundle without installing another APK. It is a proposed feature in `release-plan.md`, not an implemented feature of this release.

Evidence for `2026-6`:

- `package.json` has no direct `expo-updates` dependency.
- `app.json` has no EAS update URL or runtime version.
- The packaged manifest sets `expo.modules.updates.ENABLED` to false. The separate `expo-updates-interface` dependency does not establish that OTA delivery is enabled.

The current updater checks GitHub's `update.json` automatically. Downloading an APK requires pressing `Download APK`, which opens the download URL through the browser. The app does not silently download or install that APK itself.

The prompt offers `Later` and `Download APK`, but does not tell F-Droid users that the external download bypasses F-Droid's checks. F-Droid requires explicit, informed opt-in for external executable downloads. Resolve this before submission, either with appropriate consent handling or by removing the GitHub updater from the F-Droid build. The simplest proposed approach is to let F-Droid manage updates for that distribution and leave EAS OTA disabled there. This is a recommendation, not a change made by the audit.

Relevant code is in `src/features/updates/AppUpdates.tsx`, `app-update.ts`, and `open-app-update.ts`.

## Build and submission gaps

`pnpm android:beta` reads ignored private files under `.signing/`. F-Droid cannot use that command as its independent build procedure, and we must not provide our private key to make it work.

The underlying project can be generated with Expo and built through Gradle without that private signing hook. The generated Gradle release configuration currently uses a debug signing configuration by default. An F-Droid recipe must generate the project, remove or override signing appropriately, and produce the artifact expected by F-Droid. That path has not been tested in F-Droid's environment.

The general setup script also installs an emulator and a Google Play system image. These are developer-testing conveniences, not application runtime dependencies. The F-Droid recipe should install only the tools needed to build the app rather than run the complete workstation setup.

Prepare a recipe for `ninja.domi.cloudhoist` with the exact source commit, dependency preparation, SDK/NDK/JDK versions, output path, and update discovery. Because the generated Android project is ignored, version discovery should read the committed values in `app.json`. F-Droid supports custom `UpdateCheckData`; see its [build metadata reference](https://f-droid.org/docs/Build_Metadata_Reference/).

Add listing descriptions, screenshots, icon, and changelog metadata. Run metadata lint and the prepared-source scanner, then build in the F-Droid environment. The submission guide strongly recommends upstream listing metadata; lack of a particular Fastlane directory is not itself a software-freedom violation. The acceptance gate is a usable submission with a working recipe and completed review.

## Project maturity and existing users

The earliest tracked commits are dated September 4, 2026. Three calendar months would be reached on December 4, 2026, assuming development remains active.

The inclusion policy allows exceptions to its normal maturity period, including evidence that an app already has users. Public releases and the user's real-device reports support making that case, but a test account or automated test run alone does not establish an external user base. Provide accurate beta-user evidence or wait until the normal period is met. Maintainers decide whether the exception applies.

There is no Google-style 12-testers-for-14-days requirement in the reviewed F-Droid inclusion process. A company registration and D-U-N-S number are not part of that process.

## Signing and existing installations

Byte-for-byte reproducibility is recommended, not mandatory for main-repository inclusion. F-Droid can ordinarily build and sign an app with its own key.

Our existing GitHub installations use our release key. An APK signed with a different key cannot be installed over them through a normal update. Do not tell users to uninstall or clear their app to solve that incompatibility; it risks losing their local account, backup settings, queue, and history.

F-Droid supports distributing developer-signed APKs after matching them against its own reproducible rebuild. That would preserve our signing identity, but no such rebuild has been demonstrated for Cloud Hoist. React Native's native binaries and build paths make this a separate verification task, not something the successful APK scan proves. See [F-Droid reproducible builds](https://f-droid.org/docs/Reproducible_Builds/).

## Work needed before claiming readiness

1. Create and test an independent F-Droid build recipe without private signing files or workstation-only setup steps.
2. Scan the fully prepared tree, review native dependency provenance, and complete the shipped-code and font notice inventory.
3. Resolve the external updater's consent behavior for F-Droid distribution.
4. Prepare submission and listing metadata and validate version discovery from `app.json`.
5. Establish the signing and migration approach. If preserving in-place GitHub updates, prove the developer-signed reproducible-build path.
6. Supply existing-user evidence for the maturity exception or meet the normal development period.
7. Run F-Droid lint, scanner, and build checks, then submit for maintainer review.

## Audit limits and local evidence

No F-Droid metadata lint, full F-Droid build, clean-environment rebuild, signature-copy comparison, or maintainer acceptance occurred. No new APK was built or installed. Existing phone validation is historical evidence, not a fresh functional test conducted for this report.

Detailed command output is under ignored `test-results/fdroid-audit/`: `binary-scan.txt`, `source-scan.txt`, `npm-licenses.json`, `native-dependencies.txt`, `native-coordinates.txt`, `apk-manifest.txt`, `apk-permissions.txt`, `apk-signature.txt`, and `font-licenses.json`. Those files are local supporting evidence and are not required to read this report.
