# 060 Bug: development client is missing the splash runtime

Status: done

## Found while

Installing the Room v4 build over the existing emulator app and checking its cold start.

## Symptom

Dev Launcher logs `ClassNotFoundException` for `expo.modules.splashscreen.SplashScreenManager` during application startup.

## Cause

The generated Android activity and Expo development client expect `expo-splash-screen`, but the JavaScript project does not declare the SDK-matched package.

## Fix

- Add Expo SDK 57's bundled `expo-splash-screen` version.
- Rebuild and reinstall the native development client.

## Acceptance criteria

- Cold start no longer logs a missing splash manager class.
- The app process and activity remain alive after launch.

## Verification

- Reinstalled the debug APK on API 36 and cold-started it with `am start -W`.
- The app process stayed alive and logcat contained no `SplashScreenManager`, `ClassNotFoundException`, or fatal exception entry.

## Open question

**Question:** Should we remove splash handling instead?

**Default:** No. Keep Expo's standard startup path and declare the package its generated native code expects.
