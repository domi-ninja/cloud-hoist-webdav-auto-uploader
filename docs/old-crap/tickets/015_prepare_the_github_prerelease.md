# 015 Prepare the GitHub prerelease

Status: deferred by Domi on 2026-09-28 while testing locally. Release infrastructure is not a current blocker; see [current tracking](../../tickets/README.md). The requirements below apply when publication work resumes.

Depends on: 001 through 014

## Outcome

Version 0.1.0 is reproducible, documented, licensed, clearly independent from Nextcloud, and published as a GitHub prerelease. F-Droid preparation follows without blocking the first public artifact.

## Work

- Confirm the public repository name is `cloud-hoist` while leaving the local folder unchanged.
- Finalize the original app icon and store artwork without Nextcloud's name, cloud logo, or modified brand assets.
- Keep the display name `Cloud Hoist` and Android package `ninja.domi.cloudhoist`.
- Add the compatibility statement: "Cloud Hoist uploads files to Nextcloud servers. Cloud Hoist is an independent project and is not affiliated with or endorsed by Nextcloud GmbH."
- Document supported Android and tested Nextcloud versions, permissions, battery limitations, source behavior, overwrite behavior, privacy, and explicit non-goals.
- Document reproducible pnpm and Android build commands without requiring EAS-hosted services.
- Configure release signing through secrets outside the repository. Document backup and recovery of the signing key without printing it.
- Add CI for typechecking, linting, focused tests, Android build, and license checks.
- Generate the GPL source offer and dependency license notices required for distribution.
- Publish version `0.1.0` as a GitHub prerelease with checksums, release notes, known limitations, and a link to source at the exact tag.
- Prepare F-Droid metadata and reproducible-build notes after the prerelease proves installable. Do not start Google Play submission in this ticket.

## Acceptance criteria

- A clean machine can build the documented APK from the tagged source and lockfile.
- The APK package, display name, version, signing certificate, permissions, and service declarations match documentation.
- CI passes on the release tag.
- Release notes state that v0.1 supports tested Nextcloud servers and does not promise generic WebDAV compatibility.
- Branding contains no Nextcloud product-name or logo misuse.
- The published checksum matches the downloadable APK.
- No secret, disposable account, local path, diagnostic fixture, or signing material exists in Git history or artifacts.
- The GitHub release remains marked prerelease until the physical-device evidence supports promotion.

## Verification

- Build twice from clean checkouts and compare expected reproducible outputs or document unavoidable signature differences.
- Install the release APK, complete one fresh onboarding and upload, then verify upgrade from the previous internal build preserves Room state.
- Run secret scanning and inspect the final manifest and dependency/license reports.

## Not in this ticket

- Google Play publication
- Paid promotion
- Nextcloud endorsement
- Generic WebDAV claims

## Open question

**Question:** Under which GitHub user or organization should the public repository and release live?

**Default:** Keep the repository local until Domi names the destination. Prepare all metadata for `cloud-hoist` without creating or pushing a remote.
