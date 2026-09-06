# 029 Keep acceptance credentials out of remote shell parsing

Status: complete

Found while working on: 003

## Bug

The first live-account harness passed raw credential values as `adb shell am
instrument` arguments. A credential containing a remote-shell metacharacter made
ADB reject the command before instrumentation started.

## Impact

The test could not handle real app passwords reliably, and raw values briefly
participated in remote shell parsing even though they were not printed.

## Fix

Encode every instrumentation value as unpadded URL-safe Base64 on the host,
decode only inside the debug test APK, and redact both raw and encoded values
from captured test output.

## Acceptance criteria

- App passwords containing remote-shell metacharacters reach the debug test.
- Neither raw nor encoded credential values appear in harness output.
- The application APK contains no credential-file reader or test decoder.

## Open question

**Question:** Should the harness push a temporary credential file to the emulator?

**Default:** No. URL-safe Base64 arguments avoid shell interpretation without
leaving an extra secret-bearing file to clean up on the device.
