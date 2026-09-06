# 017 Fix pnpm rejecting the approved native build

Status: completed

## Resolution

`unrs-resolver` is explicitly allowed in `pnpm-workspace.yaml`. A frozen install and peer check now complete without ignored-build failures.

Found while working on: 001

## Bug

Installing the SDK 57 lint and test toolchain with pnpm 11 exits with `ERR_PNPM_IGNORED_BUILDS` because `unrs-resolver` has a native build script and is not explicitly approved.

## Impact

The initial install appears to finish but returns a failure. A clean checkout cannot pass the required frozen-lockfile setup until build-script policy is recorded in source control.

## Fix

- Trace why `unrs-resolver` is present and confirm it belongs to the selected lint or test toolchain.
- Allow only the exact package name through pnpm's source-controlled build policy.
- Reinstall from the lockfile and verify pnpm reports no ignored builds.
- Keep the approval narrow. Do not enable dependency scripts globally.

## Acceptance criteria

- `pnpm install --frozen-lockfile` exits successfully.
- `pnpm ignored-builds` reports no unreviewed dependency scripts.
- The committed policy approves only packages required by the project.

## Open question

**Question:** Should the repository allow all dependency lifecycle scripts to avoid future install failures?

**Default:** No. Approve required packages by exact name and review every new ignored build when dependencies change.
