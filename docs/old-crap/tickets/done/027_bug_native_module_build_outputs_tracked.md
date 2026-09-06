# 027 Exclude native module build outputs

Status: complete

Found while working on: 002

## Bug

The local Expo module did not inherit the root Android project's ignore rule, so
running its Kotlin tests left `modules/webdav-upload-engine/android/build`
eligible for source control.

## Impact

Generated class files, Gradle caches, and HTML test reports entered the native
contract commit. They add noise, platform-specific churn, and binary blobs.

## Fix

Ignore Android build directories beneath local modules and remove the generated
engine build directory from source control.

## Acceptance criteria

- No file below `modules/webdav-upload-engine/android/build` remains tracked.
- Running `pnpm test:native` does not dirty the worktree.
- Native source and focused Kotlin tests remain tracked.

## Open question

**Question:** Should every nested `build` directory be ignored globally?

**Default:** No. Scope the rule to Android local modules so a legitimate source
directory named `build` elsewhere is not hidden.
