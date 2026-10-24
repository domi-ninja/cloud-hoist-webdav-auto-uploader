# F-Droid readiness

Updated October 24, 2026. Target: `ninja.domi.cloudhoist`, candidate `2026-7` / `20260007`.

## Decision and scope

F-Droid is the only planned distribution channel. Google Play, EAS OTA, and GitHub APK publishing are removed from the plan and release workflow. GitHub remains public source hosting and an issue tracker. Existing published releases are left intact.

The app is not listed in F-Droid yet. No inclusion request, issue, pull request, merge request, or message has been sent on Domi's behalf.

## Implemented

- Removed automatic GitHub update checks, APK download controls, and native Play Store integration. EAS OTA is explicitly disabled. F-Droid will manage complete APK updates, including JavaScript changes.
- Added a credential-free unsigned build path. Local signing is a separate step using the existing private key; installation verifies identity and updates in place.
- Configured Expo Android modules to compile from source. Preparation removes unused npm AARs, Apple/Windows binaries, and legacy npm-local Maven repositories. Hermes has one exact-version scanner exception under F-Droid's stated policy.
- Added an offline license inventory and an About-screen license viewer. Evidence includes package notices, pinned upstream license files, Maven POM declarations, embedded Android notices, and font licenses.
- Replaced Expo tooling `@expo/xcpretty` 4.4.4 with 4.4.6, which supplies the missing license and inherited credits. Other package-declaration fallbacks remain explicit review items.
- Added an F-Droid recipe, listing descriptions, changelog, and deterministic listing icon. The recipe remains disabled until its external gates are settled. Version-tag discovery reads the committed `app.json`.
- Replaced publishing CI with read-only checks and unsigned validation artifacts. It cannot publish GitHub APK releases or submit to a store.

## Validation so far

The unsigned candidate builds with Node 24.20.0, pnpm 11.3.0, JDK 21, Gradle 9.3.1, Android SDK/build tools 36, NDK 27.1.12297006, and CMake 3.22.1.

Type checking, lint, 97 JavaScript tests, 104 native unit tests, release-identity tests, icon generation checks, and license-inventory checks passed. F-Droid metadata lint passed using its current category list. APK scanning found no known non-free classes or unexpected signing blocks; permission/privacy checks passed.

The prepared dependency tree scanned with zero errors. One warning concerns the unused Fontisto font file. The only ignored finding is the pinned Linux Hermes compiler; there is no blanket exclusion of `node_modules` or Gradle scripts.

Two initial builds in separate directories matched every ZIP entry except 32 native libraries. Twenty-eight differed only in GNU build IDs; four also embedded an absolute source filename. Compiler path normalization is implemented; its verification and final phone validation are in progress. Do not treat the initial comparison as a reproducibility pass.

## Remaining gates

1. Finish the normalized-build comparison and F-Droid recipe build validation. A local workstation build does not establish acceptance by F-Droid's build infrastructure.
2. Validate the final signed candidate on the physical phone and inspect privacy-safe listing screenshots.
3. Complete upstream notice review where packages omit standalone license files. Published SPDX declarations and author metadata are retained as evidence, not substituted for verified copyright notices.
4. Preserve the signing identity for existing users. F-Droid's developer-signed workflow requires a reproducible rebuild and a publicly downloadable signed reference APK. Reference-artifact hosting is not configured. A new F-Droid signing key would prevent ordinary in-place updates of current installations; uninstalling or clearing data is not an acceptable automatic migration.
5. Address project maturity. History begins September 4, 2026. Before December 4, 2026, inclusion needs an applicable exception, such as accurate evidence of existing users. Maintainers decide whether it applies.
6. Domi submits the prepared work for review when the technical and signing gates are resolved. External review and publication cannot be completed under the instruction prohibiting outreach and PRs.

No company registration, D-U-N-S number, or Google-style 12-testers-for-14-days process is part of the reviewed F-Droid inclusion procedure.

## Sources and evidence

Policy and packaging references: [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/), [submission guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/), [build metadata](https://f-droid.org/docs/Build_Metadata_Reference/), and [developer-signed reproducible builds](https://f-droid.org/docs/Reproducible_Builds/).

The operational workflow is in [docs/publishing.md](docs/publishing.md); the remaining sequence is in [release-plan.md](release-plan.md). Local logs, scan output, build comparisons, and phone captures are under ignored `test-results/fdroid-audit/`. They contain validation details and are not submission artifacts.
