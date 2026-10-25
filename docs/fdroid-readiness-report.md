# F-Droid readiness

Updated October 25, 2026. Candidate: `ninja.domi.cloudhoist`, `2026-10` / `20260010`.

F-Droid is the production target; beta builds default to GitHub APK updates. Explicit `CLOUD_HOIST_CHANNEL=fdroid` builds check and open F-Droid only. The app is **not listed or published in F-Droid**. The previously verified `2026-9` reference remains unchanged. Starting with `2026-10`, beta and F-Droid binaries are separate artifacts and require separate validation; a beta test does not establish F-Droid reproducibility.

## Attribution

The [per-package catalogue](../licenses/attribution-review.md) resolves all sixteen npm cases raised in the earlier review. Seven package/version replacements provide complete published notices or expose previously bundled dependencies. Retained packages have complete README/source/upstream notices or an explicitly reviewed MIT grant with the full terms and all supplied credits. Five further cases exposed by the Jimp replacement are also resolved. No upstream licensing question remains open in the catalogue.

The offline inventory contains 979 app/package/font entries and 395 deduplicated notice texts. Twenty-eight component groups account for imported C++ code, image codecs, runtime notices, JNI headers, and OkHttp's MPL-covered Public Suffix List. Full source URLs, notice texts, evidence hashes, and parent-version bindings are checked in under `licenses/`. The Public Suffix List's readable source is retained and round-trips to the rules and exceptions in the distributed data.

The Gradle inventory now resolves actual release artifacts instead of guessing filenames. It accounts for 149 artifacts and 39 metadata/platform components across 188 Maven coordinates. Notice collection reads nested JARs inside AARs. Release checks reject missing evidence, changed parent versions, unaccounted APK libraries, and changed C++ runtime hashes. All 21 native libraries are accounted for on every ABI.

## Current candidate, 2026-10

Tested source is `bc417d274c9badeb6fdbde01e0011f7258c56d03`. Beta and F-Droid APKs built locally for all four ABIs and were signed with the existing certificate. Both were installed in place on Samsung SM-A166B / Android 16, serial `RZCY31RD70Z`. The phone is left on the beta build. Accounts, backup sources, upload root, transfer rules, and the existing 21 completed uploads were preserved.

Validation covers whole-card movement, short-swipe cancellation, repeated right-swipe setup, left hide and Undo, thumbnail scrolling, hidden-folder persistence across restart, individual and bulk restoration, GitHub automatic/manual checks, the explicit F-Droid check, and the revised About link. Six temporary photos were backed up and downloaded with matching SHA-256 hashes. The image view shows local photos, reports a missing local/remote image, and succeeds on retry after restoring the remote original. Test-owned sources and local/remote folders were removed.

Type checking, lint, icons, notices, privacy, 119 JavaScript tests, 111 native JVM tests, seven Node release/attribution tests, and the Python artifact test pass. Four isolated native tests on the phone cover original-image bytes and cache reuse, declared/chunked size limits, failed/empty-response recovery, and invalid paths. Metadata lint passes against the current categories. A prepared-source snapshot, with local Gradle outputs removed, scans with zero errors and the existing unused Fontisto warning. The F-Droid APK scanner reports no known non-free classes or unexpected signing blocks.

The two signed APKs remain local. The beta APK is `dist/cloud-hoist-2026-10.apk`, SHA-256 `34fa4f47c054977569403786f30560e00ad92b4d537b75ad46d1e18d25aacfb5`. The F-Droid APK is `dist/fdroid/cloud-hoist-2026-10.apk`, SHA-256 `68339cd6aa1d58b6cfdf50eeec79b11141b157191c05f9b7b1804b9f606418c1`. Neither is published. A clean F-Droid build-runner pass, independent CI comparison, signature reconstruction, and public-reference verification have not been performed for this version. Earlier evidence below applies to 2026-9. The 2026-10 recipe stays disabled pending those checks and external review.

## Validation of 2026-9

| Check | Result |
| --- | --- |
| Type checking, lint, icon and notice checks | Pass |
| JavaScript tests | 109 pass, including unavailable listings, HTTP/network failures, malformed responses, timeouts, and unpublished suggested versions |
| Native JVM tests | 111 pass, including missing parents, non-404 failures, retry limits, and account-root protection |
| Release identity and attribution tests | Five Node tests and one Python nested-artifact test pass |
| F-Droid metadata lint | Pass against the current category list |
| Prepared-source scan | Zero errors; one warning for the unused Fontisto font file |
| F-Droid build and APK scan | Pass with fdroidserver 2.4.5; no known non-free classes or unexpected signing blocks reported |
| Dependency and embedded-code gates | All 188 coordinates match; 21 library names match on all four ABIs; reviewed C++ runtime hashes match |
| Privacy check | Release dependencies, permissions, and providers pass |
| Developer-signature verification | F-Droid `verify_apks` passes; signature-copy reconstruction matches the signed APK byte-for-byte |
| Physical phone | Signed in-place update on Samsung SM-A166B / Android 16; eight screen/state checks and three isolated WebDAV transport checks pass |
| Preserved app state | Account, upload root, transfer switches, and the complete Backups screen are unchanged |
| Real Nextcloud recovery | Removing a test-owned parent after listing it triggers automatic recreation of both parent and child; selection is enabled, navigation works, and the downloaded neighboring file has the same SHA-256 |
| Independent CI comparison | Pass: the unsigned CI APK is byte-identical to the local build |
| Public reference APK | Pass: anonymous download matches the phone-tested APK and reconstructs against the independent CI build |

The [CI run](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/actions/runs/40181727366) passed. Its unsigned APK matches the local build byte-for-byte. The anonymous public APK download matches the signed phone-tested artifact and passes F-Droid signature reconstruction against that independent build.

Phone validation checks automatic and manual update-check failures, the revised About description, offline notice access, missing remote parents, upward navigation, browser closure, and preserved settings/backups. The F-Droid listing currently returns 404, so successful "up to date" and update-available states are covered by unit tests rather than claimed as live store results. The UUID-owned Nextcloud fixture was deleted after verification. Upload transfer code did not change; earlier real upload/move/hash tests and attribution-specific phone checks remain recorded in Git history.

The build uses Node 24.20.0, pnpm 11.3.0, JDK 21, Gradle 9.3.1, Android SDK/build tools 36, NDK 27.1.12297006, and CMake 3.22.1. Local builds use Ubuntu OpenJDK 21; independent CI uses Temurin 21. F-Droid must still confirm its dedicated build environment. Privileged build-server provisioning was not run on the workstation.

## Artifact identity

Tested source commit: `a13d81ff4427d7af45674f0db97104e8b35248cd`.

```text
Unsigned APK SHA-256:
1db9aa255c66898ea7db2ef7a771c3d38877bdbc9cbce3c3249e9c12bb16fe19

Signed, phone-tested APK SHA-256:
95dbf351bcc5f2d4b2a5fa103ca7e95263b07caccd6bb90085cad89676d6e6c1

Existing signing certificate SHA-256:
111bd9eac655fbf8ba26cf2155a50b13f50d66c0241a75c0b29a93bcc571e6a3
```

The signed candidate is local at `dist/cloud-hoist-2026-9.apk` and public in the [GitHub verification prerelease](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/tag/fdroid-reference-2026-9), with `SHA256SUMS`. Its tag and the disabled candidate recipe pin the tested source commit. The recipe retains the versioned `Binaries` URL and existing certificate. Reference tags stay outside normal version discovery. Earlier reference artifacts and the normal latest release, `v2026-6`, remain unchanged. No normal `v2026-9` source tag was published.

## Source and reproducibility

Expo's npm packages contained unused Android AARs and other platform binaries. Expo Android modules now compile from source; preparation removes unused prebuilts and legacy npm-local Maven repositories. The only scanner exception is the exact pinned Linux Hermes compiler permitted by F-Droid's policy. There is no blanket `node_modules` or Gradle-script exclusion.

Earlier independent builds differed in 32 native libraries. Source, Gradle-cache, and SDK path normalization removes embedded build-machine paths. Reanimated's path-dependent ThinLTO build ID is omitted while retaining optimization. React Native's unused release dev-server address is pinned to loopback, avoiding a host LAN address in resources. Local signing preserves ZIP padding and checks 16 KB alignment so F-Droid can reconstruct the signed APK. These fixes established byte-identical local and independent CI builds for `2026-7`; the same comparison passes for `2026-9`.

Unsigned builds need no private signing files or store/Expo account. CI runs source, build, and APK checks from a clean Git checkout and retains unsigned artifacts. It cannot publish releases. Its temporary recipe omits `Binaries` while building a new unsigned candidate; signature reconstruction runs separately after local signing. The actual candidate recipe retains the reference URL.

Listing text, icon, changelog, and three reviewed screenshots are under `fastlane/metadata/android/en-US/`. The screenshots came from an isolated emulator installation and contain no live phone account or backup content.

## Remaining gates

1. F-Droid must validate the recipe in its build environment and review dependencies, assets, and any anti-feature decisions. The recipe remains disabled and automatic build updates remain off until review.
2. Project history starts September 4, 2026. Before December 4, inclusion needs an applicable maturity exception supported by accurate evidence of existing users. Otherwise, wait for the normal development period. Maintainers decide whether an exception applies.

No messages, inclusion requests, issues, PRs, or merge requests were sent on Domi's behalf. Domi controls submission. A different signing key cannot normally update the existing installation; never uninstall or clear app data as an automatic migration. F-Droid does not require company registration, a D-U-N-S number, or Google's 12-testers-for-14-days process.

Use the [publishing guide](publishing.md) for commands and signing/submission steps, and the [release plan](release-plan.md) for the remaining sequence. Current validation evidence and private phone captures are under ignored `test-results/swipe-2026-10/`; previous reference validation is under `test-results/polish-2026-9/`. Attribution evidence is under `test-results/attribution/`; earlier reproducibility and upload evidence remains under `test-results/fdroid-audit/`.

References: [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/), [submission guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/), [build metadata](https://f-droid.org/docs/Build_Metadata_Reference/), and [developer-signed reproducible builds](https://f-droid.org/docs/Reproducible_Builds/).
