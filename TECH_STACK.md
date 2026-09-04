# Technology stack

This project is an Android-first, open-source React Native app for reliable automatic uploads to Nextcloud.

## Locked choices

- **App:** React Native with Expo and TypeScript in strict mode
- **Package manager:** pnpm
- **Styling:** NativeWind 4 with Tailwind CSS 3
- **Navigation:** Expo Router
- **Server state:** TanStack Query where request caching and synchronization are useful
- **Local persistence:** Expo SQLite for durable upload jobs and app state
- **Secrets:** Expo SecureStore for credentials and tokens
- **Android development:** Android Studio emulator with an Expo development build
- **Native project management:** Expo prebuild / Continuous Native Generation
- **Delivery:** EAS-compatible builds, without requiring EAS-hosted services

Package versions will be pinned together during bootstrap using the current Expo-compatible versions and committed in `pnpm-lock.yaml`.

## Architecture boundary

Expo Go is not a runtime target. Dependable background uploads may require Android WorkManager, foreground services, boot handling, and custom Expo modules or config plugins. The project may add that native Android code without abandoning Expo for the rest of the app.

The app is local-first and has no application backend. It talks directly to user-configured Nextcloud servers using their supported remote APIs. Credentials stay on the device.

## Defaults

- Prefer Expo SDK modules before adding third-party native dependencies.
- Keep application code under `src/`, organized by feature once that structure earns its keep.
- Use inferred types and validate data at external boundaries; do not use `any`.
- Add focused tests for upload-queue behavior and other failure-prone domain logic.
- Start with Android only. Do not carry iOS or web complexity until either becomes an explicit goal.

## Deliberately undecided

The Nextcloud authentication flow, upload protocol, Android scheduling strategy, media discovery mechanism, and minimum supported Android version will be selected during product and technical planning.
