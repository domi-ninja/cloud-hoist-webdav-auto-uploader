# WebDAV Auto Upload technology stack

WebDAV Auto Upload is an Android-first, open-source React Native app for reliable automatic uploads to Nextcloud.

## Project identity

- **Display name:** WebDAV Auto Upload
- **Expo slug and public repository:** `webdav-auto-upload`
- **Android package:** `ninja.domi.webdavautoupload`
- **Local directory:** `domi-nextcloud-auto-upload` remains unchanged

## Locked choices

- **App:** React Native with Expo and TypeScript in strict mode
- **License:** GPL-3.0-or-later
- **Package manager:** pnpm
- **Styling:** NativeWind 4 with Tailwind CSS 3
- **Navigation:** Expo Router
- **Server state:** TanStack Query where request caching and synchronization are useful
- **Local persistence:** Android Room over SQLite for the durable upload engine; lightweight React Native preferences for UI-only state
- **Room:** AndroidX Room 2.8.4 with KSP and exported schemas
- **Secrets:** Kotlin-owned encrypted credential storage backed by Android Keystore, accessible to headless workers but never returned to React Native after storage
- **Nextcloud HTTP:** OkHttp 4.12.0 in the Kotlin engine, with redirects disabled for authenticated API calls
- **Authentication:** Nextcloud Login Flow v2 plus a manual app-password fallback; OCS resolves the DAV user ID and server capabilities
- **Android development:** Android Studio emulator with an Expo development build
- **Native project management:** Expo prebuild / Continuous Native Generation
- **Delivery:** EAS-compatible builds, without requiring EAS-hosted services
- **Server support:** Nextcloud in v0.1; no generic WebDAV compatibility claim without interoperability tests

Package versions will be pinned together during bootstrap using the current Expo-compatible versions and committed in `pnpm-lock.yaml`.

## Architecture boundary

Expo Go is not a runtime target. Dependable background uploads may require Android WorkManager, foreground services, boot handling, and custom Expo modules or config plugins. The project may add that native Android code without abandoning Expo for the rest of the app.

The background engine is a Kotlin Expo module. Kotlin owns file discovery, the Room database, scheduling, transfers, and recovery. React Native owns setup, configuration, and status screens through a typed module API.

The app is local-first and has no application backend. It talks directly to user-configured Nextcloud servers using their supported remote APIs. Credentials stay on the device. The first release targets Nextcloud rather than claiming compatibility with every WebDAV server.

## Defaults

- Prefer Expo SDK modules before adding third-party native dependencies.
- Keep application code under `src/`, organized by feature once that structure earns its keep.
- Use inferred types and validate data at external boundaries; do not use `any`.
- Add focused tests for upload-queue behavior and other failure-prone domain logic.
- Start with Android only. Do not carry iOS or web complexity until either becomes an explicit goal.

## Deliberately undecided

Transfer chunk sizing, Android scheduling details, and media discovery internals will be selected in their implementation tickets.
