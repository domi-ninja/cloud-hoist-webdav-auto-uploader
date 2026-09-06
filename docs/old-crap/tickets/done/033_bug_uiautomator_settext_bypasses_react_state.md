# 033 Keep live credentials out of UI Automator text injection

Status: complete

Found while working on: 003

## Bug

UI Automator's accessibility `setText` operation changed the visible native
`EditText` values but did not emit React Native's `onChangeText` events. The
screen therefore rejected the visually populated form as empty.

## Impact

The live account test could not submit credentials through the same state path a
user exercises, producing a false validation failure.

## Fix

Stop using UI Automator for live credentials. A debug-only provider passes
encoded values to the production account manager inside the app UID. UI
Automator now checks only fixed account-screen controls and connected state.
Ticket 011 owns component coverage for the normal React input path.

## Acceptance criteria

- Live credentials reach the production native account manager in the app UID.
- UI automation never fills, dumps, or screenshots credential fields.
- Raw credentials never become shell commands or test output.

## Open question

**Question:** Should the production form expose a debug-only fill command?

**Default:** No. Keep the provider debug-only and test the React input path with
non-secret component fixtures in ticket 011.
