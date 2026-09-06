# 030 Dismiss Expo's first-run developer menu in acceptance tests

Status: complete

Found while working on: 003

## Bug

The live harness clears application data for a repeatable account test. On the
next launch, Expo's development client presents a first-run developer-menu sheet
over the app and masks the connection controls from UI Automator.

## Impact

The account test timed out before entering any credentials even though the React
Native screen had loaded successfully behind the sheet.

## Fix

Allow a short debug-only window for a `Continue` control and dismiss it before
waiting for app-owned controls. Apply the same check after process death without
making the Expo sheet a requirement.

## Acceptance criteria

- A clean development-client install reaches the account form automatically.
- Subsequent launches work when the Expo sheet is absent.
- Production UI contains no special case for development-client onboarding.

## Open question

**Question:** Should the harness stop clearing app data to avoid this sheet?

**Default:** No. A deterministic empty account state is worth handling the
debug-only first-run sheet in the debug-only test.
