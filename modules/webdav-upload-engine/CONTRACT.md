# Native engine contract

`WebDavUploadEngine` is the only React Native boundary to the Android upload engine.

Read calls return complete snapshots and lists. TypeScript treats every native response as `unknown` and validates it before exposing inferred domain types. Commands return a small typed result union; safe native exception messages cross the bridge, while arbitrary thrown values become `native_failure`.

Commands emit `onSnapshotInvalidated` after state changes. The event carries only a monotonically increasing revision. Consumers refetch the complete snapshot instead of reducing partial native state in JavaScript.

Fixture calls are fast and deterministic apart from timestamps. Real database, discovery, scheduling, and DAV implementations added later must run blocking work on background dispatchers. Account secrets never belong in return values, events, messages, or errors.

Account calls are native async functions because they perform network and secure
storage I/O. `connectManual` validates and stores one app-password account.
`startLoginFlow` returns a public browser URL and opaque attempt ID;
`pollLoginFlow` returns either `pending` or a secret-free account summary.
`cancelLoginFlow` discards the in-memory polling token. `verifyStoredAccount`
reloads the encrypted credential inside Kotlin and repeats the authenticated OCS
checks without passing the password through React Native.

Authenticated requests never follow redirects. Android's normal TLS trust store
is the only trust decision; certificate failures have no bypass. The native
module returns stable safe error codes for invalid credentials, maintenance,
unsupported responses, redirects, certificate failures, and network failures.

## Scaffolding note

Expo SDK 57's local-module generator ignored an explicit destination and created
`modules/my-module`. If this module must be recreated, generate it locally, move
the result to `modules/webdav-upload-engine`, then confirm the resolved Android
project with `pnpm exec expo-modules-autolinking resolve --platform android`.
