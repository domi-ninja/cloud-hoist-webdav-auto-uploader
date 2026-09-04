# 050 Bug: test document provider rejects fixture queries

Status: in progress

## Found while

Running `AndroidDocumentTreeGatewayTest` on the Android 16 emulator for ticket 008.

## Symptom

The content resolver throws `SecurityException` before the test-only documents provider can return its seeded tree. The discovery layer correctly maps that to `permission_revoked`, so the emulator test fails before it exercises traversal.

## Cause

The test manifest applies the system-only `android.permission.MANAGE_DOCUMENTS` permission to the fixture provider. That permission is appropriate for a system picker-facing production provider, but this provider exists only inside the instrumentation APK and must be queryable by the test process.

## Fix

- Remove the system permission guard from the instrumentation-only provider.
- Keep the provider out of main and release manifests.
- Rerun the document-tree emulator test.

## Acceptance criteria

- The fixture tree can be queried on the emulator.
- The provider remains confined to the Android test APK.
- The release manifest has no fixture provider.

## Open question

**Question:** Should the fixture provider emulate Android's system permission boundary?

**Default:** No. Permission revocation has a separate gateway check. This fixture should test provider traversal only.
