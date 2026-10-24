# F-Droid release plan

F-Droid is Cloud Hoist's only distribution target. Google Play, hosted EAS updates, separate beta application IDs, and GitHub APK publishing are no longer planned. GitHub remains public source hosting and an issue tracker.

## One app and one update path

Keep `ninja.domi.cloudhoist` and the release identity in `app.json`. Every JavaScript, UI, native, permission, or asset change ships in a complete APK through F-Droid. The app performs no external update checks or executable downloads.

Use `year-minor`, Android versionCode = year × 10000 + minor, and package.json `year.minor.0`. Documentation changes do not create app releases.

## Completed locally

- Credential-free unsigned builds, Expo Android source compilation, and preparation that removes unused prebuilts.
- F-Droid candidate recipe, listing text, icon, screenshots, changelog, and version discovery from tagged `app.json` files.
- Offline license notices and a build gate for changes to the reviewed Android dependency inventory.
- F-Droid source/build/APK checks, independent byte-identical builds, and successful developer-signature reconstruction.
- Signed in-place installation of candidate `2026-7` on the physical phone, changed-control checks, isolated destination edge tests, and real Nextcloud hash checks. Existing app data is retained.
- Read-only CI checks and unsigned artifacts, with no store submission or GitHub APK publishing.

## Remaining sequence

1. Resolve the remaining upstream notice-attribution review and confirm the recipe on F-Droid's build infrastructure.
2. Choose a public host for the already tested signed reference artifact needed by F-Droid's verification. This is verification evidence, not a separate app-managed update channel. Keep the private key local.
3. Set the recipe's `Binaries` URL, retain `AllowedAPKSigningKeys` for the existing certificate, and resolve the candidate disable flag. Never accept a new signing identity or clear existing app data silently.
4. Publish the tested source revision/tag when the reference-artifact arrangement is ready. The APK must match the phone-tested candidate; upload retries reuse it.
5. Domi submits the prepared work. The project began September 4, 2026; submission before December 4 needs an applicable maturity exception supported by accurate evidence of existing users.
6. After acceptance, enable the recipe's automatic version-tag builds. Users install and update through F-Droid.

Do not contact maintainers or file inclusion issues, PRs, or merge requests under the current instruction. No APK or release tag has been published during preparation; reference hosting and review remain unresolved. The current recipe remains disabled and automatic build updates remain off. F-Droid acceptance and publication are outstanding.

Commands belong in [docs/publishing.md](docs/publishing.md). Evidence, limits, artifact hashes, and blockers are in [fdroid-readiness-report.md](fdroid-readiness-report.md).
