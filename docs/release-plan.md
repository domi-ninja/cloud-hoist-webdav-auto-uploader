# Release plan

Beta users receive signed APKs through GitHub Releases. F-Droid is the production target. Builds default to beta; production builds explicitly select `CLOUD_HOIST_CHANNEL=fdroid`. Keep one package and signing identity. Google Play and EAS OTA are excluded.

## One app, two build channels

Keep `ninja.domi.cloudhoist` and the release identity in `app.json`. Every JavaScript, UI, native, permission, or asset change ships in a complete APK. Beta builds check published GitHub APKs, including prereleases, and open the download in the browser. F-Droid builds check its catalogue and open F-Droid. Build outputs remain separate; reference APKs must match the F-Droid build, not the beta build.

Use `year-minor`, Android versionCode = year × 10000 + minor, and package.json `year.minor.0`. Documentation changes do not create app releases.

## Completed locally

- Credential-free unsigned builds, Expo Android source compilation, and preparation that removes unused prebuilts.
- F-Droid candidate recipe, listing text, icon, screenshots, changelog, and version discovery from tagged `app.json` files.
- Offline notices, a [package-by-package attribution catalogue](../licenses/attribution-review.md), and release gates for reviewed dependency versions, embedded notices, and every APK native library.
- F-Droid source/build/APK checks, byte-identical local and independent CI builds, and successful developer-signature reconstruction.
- Signed in-place installation of candidate `2026-9` on Samsung SM-A166B / Android 16, with eight screen/state checks, three isolated WebDAV transport tests, and real Nextcloud folder recovery with a downloaded preservation hash. Earlier releases cover attribution notices and upload/move/hash checks. Existing app data is retained.
- Read-only CI checks and unsigned artifacts, with no store submission.
- GitHub verification prereleases for signed reference APKs, with a versioned `Binaries` URL and the existing signing certificate pinned in the recipe.

## Remaining sequence

1. Domi submits the prepared recipe and catalogue. The project began September 4, 2026; submission before December 4 needs an applicable maturity exception supported by accurate evidence of existing users.
2. F-Droid validates the recipe on its infrastructure and completes maintainer review. Keep the existing signing certificate and versioned `Binaries` URL. Resolve the candidate disable flag with that review; never accept a new signing identity or clear app data silently.
3. Publish normal version tags at tested source revisions when preparing accepted releases. Each reference APK must match its phone-tested candidate; upload retries reuse the file. Enable automatic version-tag builds after initial acceptance.
4. Production users install and update through F-Droid. Beta users continue using GitHub prereleases tagged `beta-<version>`.

Do not contact maintainers or file inclusion issues, PRs, or merge requests under the current instruction. The signed reference APK is hosted in GitHub Releases under `fdroid-reference-2026-9`; its public download and independent CI comparison pass. F-Droid review and publication remain external gates. The current recipe remains disabled and automatic build updates remain off.

Commands belong in [publishing.md](publishing.md). Evidence, limits, artifact hashes, and blockers are in [fdroid-readiness-report.md](fdroid-readiness-report.md).
