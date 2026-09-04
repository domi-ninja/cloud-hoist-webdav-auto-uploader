# 036 Instrument app storage instead of the library test host

Status: in progress

Found while working on: 003

## Bug

The local module's Android test APK initially instrumented its generated library
test host. UI input injection therefore ran outside the React Native app process,
and native storage assertions would have exercised the wrong package.

## Impact

The harness could neither drive controlled React Native fields reliably nor
prove that credentials persisted in WebDAV Auto Upload's own private storage.

## Fix

Expose a provider only in the debug AAR so host tests can invoke the production
Kotlin account manager inside the app UID. Force-stop the app, invoke the provider
again to reload and validate the credential, then use the library-owned runner
only to check the connected RN screen.

## Acceptance criteria

- Debug provider calls run under `ninja.domi.webdavautoupload`.
- A post-force-stop provider call reloads the first phase's encrypted credential.
- The connected React Native screen renders from the same app-owned metadata.

## Open question

**Question:** Should account acceptance continue typing through the UI?

**Default:** No. Ticket 011 owns full onboarding UI automation. This ticket must
prove the native manual-authentication and encrypted process-death boundary.
