# F-Droid readiness

Updated October 24, 2026. Candidate: `ninja.domi.cloudhoist`, `2026-7` / `20260007`.

## Goal and result

F-Droid is the only distribution target. Google Play, EAS OTA, GitHub APK publishing, and the app's GitHub updater are removed from the plan and release workflow. GitHub remains public source hosting and an issue tracker. Existing published releases are left intact.

The candidate builds through F-Droid's own tools, reproduces locally, and updates the existing physical-phone installation with the original key. It is **not listed or published in F-Droid**. Submission and review remain external gates; no messages, inclusion requests, issues, PRs, or merge requests were sent on Domi's behalf.

## What changed and why

Expo's npm packages contained precompiled Android AARs and unused platform binaries. The build now compiles Expo Android modules from source and removes unused prebuilts and legacy npm-local Maven repositories. The only source-scanner exception is the exact pinned Linux Hermes compiler, explicitly permitted by F-Droid's policy. There is no blanket `node_modules` or Gradle-script exclusion.

Initial independent builds differed in 32 native libraries. Compiler path normalization fixed source filenames and debug-derived build IDs. Reanimated's remaining ThinLTO build ID is omitted while retaining optimization. Cross-machine comparison then found one remaining resource difference: React Native embedded each build host's LAN address in release resources. Release builds now pin that unused dev-server address to loopback. Android's signer also rewrote ZIP padding by default; local signing now preserves and checks alignment so F-Droid can reconstruct the signed APK.

The app has no external update checks, APK download controls, or Play Store integration. EAS OTA is explicitly disabled. Future JavaScript, UI, native, and asset updates all go through a complete APK managed by F-Droid.

Unsigned builds need no private signing files or store/Expo account. Local signing and in-place installation are separate steps. CI runs F-Droid source, build, and APK checks from a clean Git checkout and retains unsigned validation artifacts; it cannot publish releases. Markdown-only main pushes skip APK builds.

The repository now contains the candidate recipe, version-tag discovery, listing text, icon, changelog, and three reviewed screenshots from an isolated emulator installation. Screenshots contain no existing phone account details or backup content.

## Validation

| Check | Result |
| --- | --- |
| Type checking, lint, icon and notice checks | Pass |
| JavaScript tests | 97 pass |
| Native JVM tests | 104 pass |
| Release identity tests | 2 pass |
| Physical-phone destination edge tests | 29 pass, using isolated in-memory databases |
| Real Nextcloud test on the physical phone | Pass: uploads, moves, identical-content deletion, numbered conflicts, queued copies, and downloaded SHA-256 comparisons; UUID-owned server fixtures cleaned up |
| F-Droid metadata lint | Pass against the current category list |
| Prepared-source scan | Zero errors; one warning for the unused Fontisto font file |
| F-Droid build and APK scan | Pass with fdroidserver 2.4.5; no known non-free classes or unexpected signing blocks reported |
| Native dependency notice gate | All 188 coordinates match; deliberately removing one reviewed entry correctly rejects the build |
| Independent build comparison | Byte-identical unsigned APKs from the working tree, a clean local F-Droid checkout, and an independent GitHub CI runner |
| Developer-signature verification | F-Droid `verify_apks` passes; signature-copy reconstruction matches the signed APK byte-for-byte |
| Physical installation and changed UI | Signed in-place update on Samsung SM-A166B, Android 16; version, license search/expansion, empty search, reopening, and Android Back verified |
| Existing app state | Original account, three backup folders, two disabled/one enabled states, 19/14 pending-file counts, and 21 completed uploads retained |

The build uses Node 24.20.0, pnpm 11.3.0, JDK 21, Gradle 9.3.1, Android SDK/build tools 36, NDK 27.1.12297006, and CMake 3.22.1.

```text
Unsigned APK SHA-256:
278f82a1fa1ee747a6f9ed4ef5d0bc4bf0cbbc3974faaba748683d6fc10e38b3

Signed, phone-tested APK SHA-256:
5914ac7e010358ea3fe3e6d9cae35c3d924202dece04f4cde070abc53c249e31

Existing signing certificate SHA-256:
111bd9eac655fbf8ba26cf2155a50b13f50d66c0241a75c0b29a93bcc571e6a3
```

The [final CI run](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/actions/runs/40106053725) passed and produced the same unsigned SHA-256. Local builds used Ubuntu OpenJDK 21; the independent Ubuntu CI runner used Temurin 21. Local checkouts shared dependency caches; CI built separately. F-Droid must still confirm its dedicated build environment. Privileged build-server provisioning was not run on the workstation.

## Remaining gates

1. **Signed reference hosting.** Preserving upgrades for existing installations requires F-Droid's developer-signed workflow. Local rebuild/signature verification now passes, but no public reference-APK URL is configured. The recipe is disabled, with the existing certificate recorded. Set `Binaries` only after choosing a host for verification artifacts; do not introduce another app-managed update channel or share the private key.
2. **Upstream attribution review.** The offline inventory contains 874 app/library/font entries. Sixteen npm packages omit standalone license files and rely on preserved published declarations, source headers, or README notices. These fallbacks remain explicit review items. The missing notice in `@expo/xcpretty` 4.4.4 was resolved by pinning 4.4.6, which supplies the full license and inherited credits. The notice inventory is not an exhaustive attribution manifest for code embedded inside native binaries, including the NDK C++ runtime and React Native vendor libraries. Maven POM declarations alone do not establish that coverage. This remains part of the upstream attribution review; a successful scanner run is not an independent legal audit.
3. **F-Droid build-server and maintainer review.** The local recipe passed, but F-Droid must validate it in its environment and review dependencies, assets, and any anti-feature decisions. Agents must not open that submission under the current instruction.
4. **Project maturity.** History starts September 4, 2026. Before December 4, 2026, inclusion needs an applicable exception, such as accurate evidence of existing users. Otherwise, wait for the normal development period. Maintainers decide whether an exception applies.

A different F-Droid signing key cannot normally update the existing installation. Do not uninstall or clear app data as an automatic migration. No company registration, D-U-N-S number, or Google-style 12-testers-for-14-days process is part of the reviewed F-Droid procedure.

## Handoff

Use [docs/publishing.md](docs/publishing.md) for commands and signing/submission steps, and [release-plan.md](release-plan.md) for the remaining sequence. The signed candidate is local at `dist/cloud-hoist-2026-7.apk`; it has not been uploaded as another GitHub release. No release tag has been pushed.

Local logs, scan results, APK comparisons, and private phone captures are under ignored `test-results/fdroid-audit/`. Public listing screenshots are under `fastlane/metadata/android/en-US/images/phoneScreenshots/`.

References: [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/), [submission guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/), [build metadata](https://f-droid.org/docs/Build_Metadata_Reference/), and [developer-signed reproducible builds](https://f-droid.org/docs/Reproducible_Builds/).
