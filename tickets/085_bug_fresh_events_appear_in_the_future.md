# 085 Bug: fresh events appear in the future

Status: in progress

Found while verifying: 083

## Problem

Immediately after the emulator verifies the account or finishes a scan, the interface can say "Checked in a moment" or "Last scan in a moment." The Android timestamp can be a fraction of a second ahead of the JavaScript clock used to render relative time.

## Fix

- Treat past or future differences under one minute as "just now."
- Keep future wording for scheduled events at least one minute away.
- Add a focused formatter test for sub-minute future clock skew.

## Acceptance criteria

- A fresh Android event never renders as "in a moment."
- A future timestamp three minutes away still renders as "in 3 minutes."
- Existing past relative-time behavior is unchanged.

## Verification

- Run the formatter tests.
- Trigger a pull-to-scan on the emulator and inspect the status after completion.

## Open question

**Question:** Should the formatter use a smaller clock-skew window than one minute?

**Default:** No. The interface has minute precision, so any sub-minute difference should read as "just now."
