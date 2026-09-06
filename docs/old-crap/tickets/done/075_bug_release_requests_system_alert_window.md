# 075 Release requests system alert window

Status: completed

Found while: verifying ticket 013 production dependencies and manifest privacy

## Problem

The release APK requested `android.permission.SYSTEM_ALERT_WINDOW`. Automatic uploads do not need permission to draw over other apps; the permission was inherited from Expo development tooling and made the production permission surface misleading.

## Resolution

- Blocked `android.permission.SYSTEM_ALERT_WINDOW` through Expo's Android config so prebuild removes transitive declarations.
- Added a repeatable privacy check for telemetry dependencies, advertising identifiers, and prohibited release permissions.
- Rebuilt the release APK and inspected its packaged permissions.

## Verification

- `pnpm test:privacy`
- Confirmed `INTERNET`, `POST_NOTIFICATIONS`, and `FOREGROUND_SERVICE_DATA_SYNC` remain present.
- Confirmed `SYSTEM_ALERT_WINDOW` and advertising ID access are absent.
