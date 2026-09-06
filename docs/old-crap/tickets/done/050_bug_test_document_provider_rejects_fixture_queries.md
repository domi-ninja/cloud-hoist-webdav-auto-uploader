# 050 Bug: test document provider rejects fixture queries

Status: done

## Found while

Running `AndroidDocumentTreeGatewayTest` on the Android 16 emulator for ticket 008.

## Symptom

The content resolver throws `SecurityException` before the test-only documents provider can return its seeded tree. The discovery layer correctly maps that to `permission_revoked`, so the emulator test fails before it exercises traversal.

## Cause

Android requires every `DocumentsProvider` subclass to declare the system-only `android.permission.MANAGE_DOCUMENTS` permission. Keeping the permission rejects the test caller. Removing it crashes the instrumentation process while Android installs the provider.

## Fix

- Use a plain instrumentation-only `ContentProvider` that implements the document query URI shape without requiring a system permission.
- Keep the provider out of main and release manifests.
- Rerun the document-tree emulator test.

## Acceptance criteria

- The fixture tree can be queried on the emulator.
- The provider remains confined to the Android test APK.
- The release manifest has no fixture provider.

## Open question

**Question:** Should the fixture provider emulate Android's system permission boundary?

**Default:** No. Permission revocation has a separate gateway check. This fixture should test provider traversal only.
