# F-Droid release plan

F-Droid is Cloud Hoist's only distribution target. Google Play, hosted EAS updates, separate beta application IDs, and GitHub APK publishing are no longer planned. GitHub remains a public source mirror and issue tracker.

## One app and one update path

Keep `ninja.domi.cloudhoist` and the existing release identity in `app.json`. Publish each release through F-Droid. JavaScript, UI, native engine, permission, and asset changes all travel in the same reviewed APK. The app performs no external update checks or executable downloads.

Keep `year-minor` versions, Android versionCode = year × 10000 + minor, and package.json `year.minor.0`. Documentation changes do not create app releases.

## Local preparation

1. Finish the free-software dependency and notice inventory.
2. Prepare the native project and build an unsigned APK without private signing credentials, an Expo account, or a Play account.
3. Validate the source recipe with F-Droid lint and scanner tools, then test the resulting APK.
4. Sign the existing unsigned artifact with the current key only for local physical-phone validation. Preserve existing accounts, configuration, queues, history, and files.
5. Prepare listing text, screenshots, icon, release notes, and version-discovery rules.
6. Test a second independent build and investigate reproducibility before promising in-place migration to F-Droid.
7. Update the readiness report with actual results and unresolved external requirements.

## Signing and existing users

The first F-Droid release must account for existing installations signed with our key. Prefer F-Droid's developer-signed reproducible-build workflow if it can be proven. The signed reference artifact would be evidence for F-Droid's verification, not an app-managed update channel.

If reproducibility or reference-artifact hosting cannot be established, stop and document the migration choice. Do not silently accept a new signing identity, uninstall the existing app, clear its data, or promise a seamless upgrade that has not been tested.

## Submission boundary

Prepare the recipe, metadata, evidence, and a reviewable handoff locally. Do not contact maintainers or users, open issues, or file pull or merge requests on Domi's behalf.

F-Droid's external review and publication remain outstanding until Domi submits the work. The project began on September 4, 2026. A submission before December 4, 2026 needs the existing-users exception to the normal maturity period. Do not invent tester numbers or imply that a local build grants acceptance.

## Ongoing releases

Ordinary source pushes run checks. CI builds unsigned candidates and retains validation artifacts; it does not publish APKs elsewhere. Once accepted, F-Droid discovers version tags and builds the configured source revision. Test changed Android flows on the selected physical phone before tagging a release candidate.

Operational commands belong in [docs/publishing.md](docs/publishing.md). Current evidence and blockers belong in [fdroid-readiness-report.md](fdroid-readiness-report.md).
