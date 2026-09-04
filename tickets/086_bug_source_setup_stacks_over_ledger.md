# 086 Bug: source setup stacks over the ledger

Status: in progress

Found while verifying: 083

## Problem

Starting Add source inserts the setup flow above the existing source ledger. At enlarged text, the screen contains setup, existing source controls, and global controls at once. The two tasks compete and the screen becomes several viewports tall.

## Fix

- Treat source setup as a focused mode within the Sources tab.
- Hide the existing source ledger and global scan controls while setup is open.
- Restore the ledger when setup completes or the user cancels.
- Keep the app header, engine status, account menu, and bottom tabs available.

## Acceptance criteria

- Tapping Add source shows setup without the existing source cards underneath it.
- Cancel returns to the unchanged source ledger.
- Completing setup returns to the ledger and includes the new source.
- An account with no sources still enters setup automatically.

## Verification

- Run TypeScript and Expo lint.
- Open and cancel Add source on the emulator.
- Inspect the setup screen at the current enlarged font scale.

## Open question

**Question:** Should setup move to a separate route?

**Default:** No. A focused inline mode is enough and avoids new navigation state.
