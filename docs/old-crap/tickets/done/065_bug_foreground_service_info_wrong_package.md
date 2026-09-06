# 065 Bug: foreground service type imports the wrong ServiceInfo

Status: done

## Found while

Compiling the foreground transfer notification.

## Symptom

The native module cannot resolve `ServiceInfo` or the `dataSync` foreground-service constant.

## Cause

The implementation imported `ServiceInfo` from `android.app`; Android defines it in `android.content.pm`.

## Fix

Import `android.content.pm.ServiceInfo` and keep the typed `ForegroundInfo` construction.

## Acceptance criteria

- The foreground notification compiles against API 36.
- Its `ForegroundInfo` declares the `dataSync` service type.

## Open question

**Question:** Should we omit the explicit type on older Android versions?

**Default:** No. The project minimum is API 29, where the typed constructor is available.
