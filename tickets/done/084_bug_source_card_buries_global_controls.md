# 084 Bug: source card buries global controls

Status: done

Found while verifying: 083

## Problem

At the emulator's enlarged font scale, one source card fills most of the Sources screen. Reset history and Remove source are always visible even though both are rare maintenance actions. Add source also uses a dark filled style that competes with the green Scan now action.

## Fix

- Keep source maintenance collapsed by default behind a plain Source options disclosure.
- Reveal Reset upload history and Remove source in place.
- Let the same control hide the maintenance actions again.
- Keep the disclosure accessible and expose its expanded state.
- Change Add source to a quiet action so Scan now remains the main screen action.

## Acceptance criteria

- A configured source shows its state, destination, Scan source, Change destination, and Source options without showing destructive commands by default.
- Source options reveals both maintenance commands and can collapse them again.
- The global Scan now action appears sooner in the enlarged-font layout.
- Reset and remove confirmation behavior is unchanged.

## Verification

- Run TypeScript and Expo lint.
- Install the release build and inspect Sources at the current emulator font scale.
- Expand and collapse Source options on the emulator.

## Open question

**Question:** Should the app remember whether Source options was expanded?

**Default:** No. Collapse it whenever the card mounts because these commands should stay out of the routine workflow.
