# 002 Create the typed native engine module

Status: in progress

Depends on: 001

## Outcome

A local Expo module defines the only boundary between React Native and the Kotlin background engine. The contract is typed, observable, and useful while the engine still returns fixture data.

## Work

- Create a local Expo module named `WebDavUploadEngine` with Kotlin and TypeScript entry points.
- Define serializable types for account health, global engine state, source summaries, queue counts, jobs, blockers, and worker activity.
- Model state and blockers as discriminated unions. Unknown native values must fail decoding rather than becoming `any`.
- Expose read methods for the current engine snapshot, sources, recent activity, and unresolved failures.
- Expose command methods for pause, resume, scan now, retry failed, add or update source, remove source, and reset source history.
- Add a native event for snapshot invalidation. React Native should refetch typed snapshots instead of receiving a stream of partial mutable objects.
- Keep account, DAV, database, and WorkManager implementations behind Kotlin interfaces so later tickets can test them independently.
- Return deterministic fixture state until real repositories replace it.
- Document which calls may be slow, which run on background dispatchers, and which errors cross the bridge.

## Acceptance criteria

- TypeScript consumes module results without `any`, double casting, or duplicated handwritten response shapes.
- Kotlin fixture state reaches a React Native development screen.
- A native invalidation event causes the screen to refetch and display a new fixture snapshot.
- Native exceptions become a small typed error union with a stable code and safe message.
- Unit tests cover decoding every state and blocker variant.
- Removing or renaming a required native field breaks either code generation or a focused contract test.

## Verification

- Run TypeScript typechecking and Kotlin unit tests.
- Exercise fixture commands on the emulator and confirm snapshot invalidation.
- Kill and reopen the React Native activity to confirm the module does not depend on in-memory UI state.

## Not in this ticket

- Real credentials or networking
- Room entities
- WorkManager jobs
- Production UI

## Open question

**Question:** Should native events carry full snapshots or only tell React Native which query became stale?

**Default:** Emit small invalidation events and refetch snapshots. This avoids maintaining two competing state-reduction systems across the bridge.
