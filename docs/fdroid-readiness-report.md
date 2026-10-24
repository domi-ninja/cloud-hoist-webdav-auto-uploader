# F-Droid readiness

Updated October 24, 2026. Candidate: `ninja.domi.cloudhoist`, `2026-8` / `20260008`.

F-Droid is the only distribution target. The app has no GitHub update checks, APK download controls, Play Store integration, or EAS OTA delivery. GitHub hosts source, issues, and signed reference APKs for F-Droid verification. The app is **not listed or published in F-Droid**.

## Attribution

The [per-package catalogue](../licenses/attribution-review.md) resolves all sixteen npm cases raised in the earlier review. Seven package/version replacements provide complete published notices or expose previously bundled dependencies. Retained packages have complete README/source/upstream notices or an explicitly reviewed MIT grant with the full terms and all supplied credits. Five further cases exposed by the Jimp replacement are also resolved. No upstream licensing question remains open in the catalogue.

The offline inventory contains 979 app/package/font entries and 395 deduplicated notice texts. Twenty-eight component groups account for imported C++ code, image codecs, runtime notices, JNI headers, and OkHttp's MPL-covered Public Suffix List. Full source URLs, notice texts, evidence hashes, and parent-version bindings are checked in under `licenses/`. The Public Suffix List's readable source is retained and round-trips to the rules and exceptions in the distributed data.

The Gradle inventory now resolves actual release artifacts instead of guessing filenames. It accounts for 149 artifacts and 39 metadata/platform components across 188 Maven coordinates. Notice collection reads nested JARs inside AARs. Release checks reject missing evidence, changed parent versions, unaccounted APK libraries, and changed C++ runtime hashes. All 21 native libraries are accounted for on every ABI.

## Validation of 2026-8

| Check | Result |
| --- | --- |
| Type checking, lint, icon and notice checks | Pass |
| JavaScript tests | 97 pass |
| Native JVM tests | 104 pass |
| Release identity and attribution tests | Five Node tests and one Python nested-artifact test pass |
| Jimp replacement | Expo prebuild passes; PNG and JPEG operations produce the same decoded pixels as the compact package |
| F-Droid metadata lint | Pass against the current category list |
| Prepared-source scan | Zero errors; one warning for the unused Fontisto font file |
| F-Droid build and APK scan | Pass with fdroidserver 2.4.5; no known non-free classes or unexpected signing blocks reported |
| Dependency and embedded-code gates | All 188 coordinates match; 21 library names match on all four ABIs; reviewed C++ runtime hashes match |
| Privacy check | Release dependencies, permissions, and providers pass |
| Developer-signature verification | F-Droid `verify_apks` passes; signature-copy reconstruction matches the signed APK byte-for-byte |
| Physical phone | Signed in-place update on Samsung SM-A166B / Android 16; 13 checks pass, including required credits, large-notice scrolling, search, closing/reopening, Android Back, and tab navigation |
| Preserved app state | Account, upload root, transfer rules, and 21 completed uploads retained; Settings text differs only in the version |
| Independent CI comparison | Pass: downloaded unsigned CI APK is byte-identical to the local build |
| Public reference APK | Pass: anonymous download matches the phone-tested APK and passes signature reconstruction against the independent CI build |

The [CI run](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/actions/runs/40119400305) passed and produced the same unsigned SHA-256. Its downloaded artifact matches the local APK byte-for-byte. Upload-engine code did not change in `2026-8`. The previous `2026-7` validation included 29 physical-phone destination edge tests with isolated in-memory databases, plus real Nextcloud uploads, moves, identical-content deletion, numbered conflicts, queued copies, and downloaded SHA-256 comparisons. UUID-owned server fixtures were cleaned up. Those upload tests were not repeated for this notice update.

The build uses Node 24.20.0, pnpm 11.3.0, JDK 21, Gradle 9.3.1, Android SDK/build tools 36, NDK 27.1.12297006, and CMake 3.22.1. Local builds use Ubuntu OpenJDK 21; independent CI uses Temurin 21. F-Droid must still confirm its dedicated build environment. Privileged build-server provisioning was not run on the workstation.

## Artifact identity

Tested source commit: `01ea9e2d87f9d6928a917071b2df2a806e2bf24b`.

```text
Unsigned APK SHA-256:
6084b29a05b90f0d71931515ecebacdf0fd9ae580772273995f5a686a146de9a

Signed, phone-tested APK SHA-256:
5f81be46aaf75db1cfab62e61a08c88b466e9628013bcfacb651fed7df291fd3

Existing signing certificate SHA-256:
111bd9eac655fbf8ba26cf2155a50b13f50d66c0241a75c0b29a93bcc571e6a3
```

The signed candidate is local at `dist/cloud-hoist-2026-8.apk` and public in the [GitHub verification prerelease](https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/tag/fdroid-reference-2026-8), with `SHA256SUMS`. Its tag points to the tested source commit. The recipe pins that commit, the versioned `Binaries` URL, and the existing certificate. Reference tags stay outside normal version discovery. The `2026-7` reference and normal latest release, `v2026-6`, remain unchanged. The normal source tag `v2026-8` has not been published.

## Source and reproducibility

Expo's npm packages contained unused Android AARs and other platform binaries. Expo Android modules now compile from source; preparation removes unused prebuilts and legacy npm-local Maven repositories. The only scanner exception is the exact pinned Linux Hermes compiler permitted by F-Droid's policy. There is no blanket `node_modules` or Gradle-script exclusion.

Earlier independent builds differed in 32 native libraries. Source, Gradle-cache, and SDK path normalization removes embedded build-machine paths. Reanimated's path-dependent ThinLTO build ID is omitted while retaining optimization. React Native's unused release dev-server address is pinned to loopback, avoiding a host LAN address in resources. Local signing preserves ZIP padding and checks 16 KB alignment so F-Droid can reconstruct the signed APK. These fixes established byte-identical local and independent CI builds for `2026-7`; the same comparison now passes for `2026-8`.

Unsigned builds need no private signing files or store/Expo account. CI runs source, build, and APK checks from a clean Git checkout and retains unsigned artifacts. It cannot publish releases. Its temporary recipe omits `Binaries` while building a new unsigned candidate; signature reconstruction runs separately after local signing. The actual candidate recipe retains the reference URL.

Listing text, icon, changelog, and three reviewed screenshots are under `fastlane/metadata/android/en-US/`. The screenshots came from an isolated emulator installation and contain no live phone account or backup content.

## Remaining gates

1. F-Droid must validate the recipe in its build environment and review dependencies, assets, and any anti-feature decisions. The recipe remains disabled and automatic build updates remain off until review.
2. Project history starts September 4, 2026. Before December 4, inclusion needs an applicable maturity exception supported by accurate evidence of existing users. Otherwise, wait for the normal development period. Maintainers decide whether an exception applies.

No messages, inclusion requests, issues, PRs, or merge requests were sent on Domi's behalf. Domi controls submission. A different signing key cannot normally update the existing installation; never uninstall or clear app data as an automatic migration. F-Droid does not require company registration, a D-U-N-S number, or Google's 12-testers-for-14-days process.

Use the [publishing guide](publishing.md) for commands and signing/submission steps, and the [release plan](release-plan.md) for the remaining sequence. Current validation evidence and private phone captures are under ignored `test-results/attribution/`; earlier reproducibility and upload evidence remains under ignored `test-results/fdroid-audit/`.

References: [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/), [submission guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/), [build metadata](https://f-droid.org/docs/Build_Metadata_Reference/), and [developer-signed reproducible builds](https://f-droid.org/docs/Reproducible_Builds/).
