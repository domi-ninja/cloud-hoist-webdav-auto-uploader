# F-Droid release plan

F-Droid is Cloud Hoist's only distribution target. Google Play, hosted EAS updates, separate beta application IDs, and GitHub-based user updates are no longer planned. GitHub hosts source, issues, and the signed APKs used by F-Droid for verification.

## One app and one update path

Keep `ninja.domi.cloudhoist` and the release identity in `app.json`. Every JavaScript, UI, native, permission, or asset change ships in a complete APK through F-Droid. The app performs no external update checks or executable downloads.

Use `year-minor`, Android versionCode = year × 10000 + minor, and package.json `year.minor.0`. Documentation changes do not create app releases.

## Completed locally

- Credential-free unsigned builds, Expo Android source compilation, and preparation that removes unused prebuilts.
- F-Droid candidate recipe, listing text, icon, screenshots, changelog, and version discovery from tagged `app.json` files.
- Offline notices, a [package-by-package attribution catalogue](../licenses/attribution-review.md), and release gates for reviewed dependency versions, embedded notices, and every APK native library.
- F-Droid source/build/APK checks, byte-identical local and independent CI builds, and successful developer-signature reconstruction.
- Signed in-place installation of candidate `2026-7` on the physical phone, changed-control checks, isolated destination edge tests, and real Nextcloud hash checks. Existing app data is retained.
- Read-only CI checks and unsigned artifacts, with no store submission.
- GitHub verification prereleases for signed reference APKs, with a versioned `Binaries` URL and the existing signing certificate pinned in the recipe.

## Remaining sequence

1. Complete `2026-8` build and physical-phone validation, then confirm the recipe on F-Droid's build infrastructure.
2. Retain the configured GitHub `Binaries` URL and `AllowedAPKSigningKeys` for the existing certificate. Resolve the candidate disable flag after review. Never accept a new signing identity or clear existing app data silently.
3. Publish normal version tags at the tested source revision when preparing accepted releases. Each new reference APK must match its phone-tested candidate; upload retries reuse the file.
4. Domi submits the prepared work. The project began September 4, 2026; submission before December 4 needs an applicable maturity exception supported by accurate evidence of existing users.
5. After acceptance, enable the recipe's automatic version-tag builds. Users install and update through F-Droid.

Do not contact maintainers or file inclusion issues, PRs, or merge requests under the current instruction. The signed reference APK is hosted in GitHub Releases under `fdroid-reference-2026-7`. F-Droid review and publication remain unresolved. The current recipe remains disabled and automatic build updates remain off. F-Droid acceptance and publication are outstanding.

Commands belong in [publishing.md](publishing.md). Evidence, limits, artifact hashes, and blockers are in [fdroid-readiness-report.md](fdroid-readiness-report.md).
