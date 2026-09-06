# 059 Bug: upload test app cannot open a loopback socket

Status: done

## Found while

Rerunning ticket 005's emulator upload acceptance test after fixing its teardown.

## Symptom

MockWebServer fails to create its loopback server socket with `EPERM` on Android.

## Cause

The standalone library instrumentation APK does not inherit the Expo app's network permission. Its test manifest omitted `android.permission.INTERNET`.

## Fix

Declare `INTERNET` in the Android test manifest. The permission applies only to the instrumentation fixture app.

## Acceptance criteria

- MockWebServer can listen on the emulator loopback interface.
- The direct-upload acceptance test reaches the local HTTP fixture.

## Open question

**Question:** Should this permission move to the library's production manifest?

**Default:** No. The Expo application already declares its runtime network needs. Keep this library-only server permission scoped to tests.
