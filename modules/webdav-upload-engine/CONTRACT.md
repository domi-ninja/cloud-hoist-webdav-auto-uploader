# Native engine contract

`WebDavUploadEngine` is the only React Native boundary to the Android upload engine.

Read calls return complete snapshots and lists. TypeScript treats every native response as `unknown` and validates it before exposing inferred domain types. Commands return a small typed result union; safe native exception messages cross the bridge, while arbitrary thrown values become `native_failure`.

Commands emit `onSnapshotInvalidated` after state changes. The event carries only a monotonically increasing revision. Consumers refetch the complete snapshot instead of reducing partial native state in JavaScript.

Fixture calls are fast and deterministic apart from timestamps. Real database, discovery, scheduling, and DAV implementations added later must run blocking work on background dispatchers. Account secrets never belong in return values, events, messages, or errors.
