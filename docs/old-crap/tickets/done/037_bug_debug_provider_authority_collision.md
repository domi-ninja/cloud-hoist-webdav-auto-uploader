# 037 Debug provider authority collides with the Android test host

Status: complete

Found while working on: 003

## Bug

Gradle merges the module's debug manifest into both the app APK and the library's
generated Android test-host APK. A fixed provider authority gives both packages
the same name, so Android rejects the test APK with
`INSTALL_FAILED_CONFLICTING_PROVIDER`.

## Impact

The live account test cannot install its UI assertion runner.

## Fix

Build the authority from the final package's `applicationId`. The app and test
host then receive distinct authorities while the host script can still call the
known app authority.

## Acceptance criteria

- The app and Android test APKs install together.
- The host script calls the provider owned by the app package.
- The live account test advances past installation.

## Open question

**Question:** Should the test-host copy of the debug provider be removed too?

**Default:** No. Its authority is unique and the APK is local test tooling. Avoid
custom Gradle source-set work unless the duplicate causes another failure.
