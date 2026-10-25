# F-Droid release plan

F-Droid is Cloud Hoist's only distribution target. Google Play, hosted EAS updates, separate beta application IDs, and GitHub-based user updates are no longer planned. GitHub hosts source, issues, and the signed APKs used by F-Droid for verification.

## One app and one update path

Keep `ninja.domi.cloudhoist` and the release identity in `app.json`. Every JavaScript, UI, native, permission, or asset change ships in a complete APK through F-Droid. Settings checks F-Droid's public catalogue for available versions. F-Droid handles installation; Cloud Hoist does not download executable code.

Use `year-minor`, Android versionCode = year × 10000 + minor, and package.json `year.minor.0`. Documentation changes do not create app releases.

## Completed locally

- Credential-free unsigned builds, Expo Android source compilation, and preparation that removes unused prebuilts.
- F-Droid candidate recipe, listing text, icon, screenshots, changelog, and version discovery from tagged `app.json` files.
- Offline notices, a [package-by-package attribution catalogue](../licenses/attribution-review.md), and release gates for reviewed dependency versions, embedded notices, and every APK native library.
- F-Droid source/build/APK checks, byte-identical local and independent CI builds, and successful developer-signature reconstruction.
- Signed in-place installation of candidate `2026-8` on Samsung SM-A166B / Android 16, with thirteen notice/navigation/state checks. The earlier `2026-7` upload validation includes isolated destination edge tests and real Nextcloud hash checks. Existing app data is retained.
- Read-only CI checks and unsigned artifacts, with no store submission.
- GitHub verification prereleases for signed reference APKs, with a versioned `Binaries` URL and the existing signing certificate pinned in the recipe.

## Remaining sequence

1. Domi submits the prepared recipe and catalogue. The project began September 4, 2026; submission before December 4 needs an applicable maturity exception supported by accurate evidence of existing users.
2. F-Droid validates the recipe on its infrastructure and completes maintainer review. Keep the existing signing certificate and versioned `Binaries` URL. Resolve the candidate disable flag with that review; never accept a new signing identity or clear app data silently.
3. Publish normal version tags at tested source revisions when preparing accepted releases. Each reference APK must match its phone-tested candidate; upload retries reuse the file. Enable automatic version-tag builds after initial acceptance.
4. Users install and update through F-Droid.

Do not contact maintainers or file inclusion issues, PRs, or merge requests under the current instruction. The signed reference APK is hosted in GitHub Releases under `fdroid-reference-2026-8`; its public download and independent CI comparison pass. F-Droid review and publication remain external gates. The current recipe remains disabled and automatic build updates remain off.

Commands belong in [publishing.md](publishing.md). Evidence, limits, artifact hashes, and blockers are in [fdroid-readiness-report.md](fdroid-readiness-report.md).
