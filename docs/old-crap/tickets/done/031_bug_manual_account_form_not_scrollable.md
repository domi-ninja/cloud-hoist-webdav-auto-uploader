# 031 Make the manual account form keyboard-safe and scrollable

Status: complete

Found while working on: 003

## Bug

Expanding the manual credential fallback adds three fields, explanatory text,
and a submit action inside a fixed-height `View`. The submit action can fall out
of reach when Android resizes the activity for an input method.

## Impact

Users on smaller displays or with a visible keyboard may be unable to submit
valid app credentials. UI automation also could not reach the action reliably.

## Fix

Use one screen-level `ScrollView` with a growing content container and allow taps
to dismiss or pass through the keyboard. Have the acceptance test scroll to the
submit action instead of assuming a Back key always hides a keyboard.

## Acceptance criteria

- Every manual credential field and the submit action remain reachable.
- Tapping the submit action works while an input method has participated.
- The account acceptance test does not navigate away with an unconditional Back.

## Open question

**Question:** Should the account card own a nested scroll container?

**Default:** No. Keep one screen-level scroll surface to avoid competing Android
gestures and nested keyboard behavior.
