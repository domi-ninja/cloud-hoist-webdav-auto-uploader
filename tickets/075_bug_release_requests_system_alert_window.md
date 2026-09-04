# 075 Release requests system alert window

Status: in progress

Found while: verifying ticket 013 production dependencies and manifest privacy

## Problem

The release APK requests `android.permission.SYSTEM_ALERT_WINDOW`. Automatic uploads do not need permission to draw over other apps; the permission is inherited from Expo development tooling and would make the production permission surface misleading.

## Fix

- Block `android.permission.SYSTEM_ALERT_WINDOW` through Expo's Android config so prebuild removes transitive declarations.
- Add a repeatable privacy check for telemetry dependencies, advertising identifiers, and prohibited release permissions.
- Rebuild the release manifest and verify the permission is absent.

## Acceptance criteria

- The release APK does not request `SYSTEM_ALERT_WINDOW` or advertising ID access.
- The privacy check fails if a known analytics, crash-reporting, advertising dependency, or prohibited permission appears.
- Required upload permissions remain present.
