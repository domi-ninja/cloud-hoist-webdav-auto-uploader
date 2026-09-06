# 042 Release bundle cannot resolve Babel JSX plugin

Status: complete

Found while working on: 029

## Bug

The Android release bundle loads Babel's JSX transform by package name, but the
project receives it only as a transitive dependency. pnpm's strict layout does
not make that package resolvable from the release transform process.

## Impact

Debug development works while `:app:assembleRelease` fails in
`createBundleReleaseJsAndAssets`.

## Fix

Declare `@babel/plugin-transform-react-jsx` as a direct development dependency
and build releases with `NODE_ENV=production` through the project Android
environment.

## Acceptance criteria

- The release JavaScript bundle completes.
- `:app:assembleRelease` produces an APK.
- Typecheck, lint, and Jest still pass under the locked pnpm graph.

## Open question

**Question:** Should the Babel plugin move to runtime dependencies?

**Default:** No. It runs only while transforming source, so keep it in
`devDependencies`.
