# 035 Keep account progress and errors above the form

Status: complete

Found while working on: 003

## Bug

Connection errors were rendered after every expanded manual-form control. With
the activity resized for input, the result could sit below the viewport and out
of the accessibility tree.

## Impact

Users could submit and receive no visible feedback without manually discovering
that more content existed below the action. The device test could not distinguish
a slow request from a classified account error.

## Fix

Render progress and safe error text directly below the account-card heading.
Scroll back to the top before a failed device assertion is classified.

## Acceptance criteria

- Submitting immediately shows a visible checking state.
- Safe connection errors appear above all credential fields.
- Device failures report a fixed safe error rather than field content.

## Open question

**Question:** Should connection failures also use an Android toast?

**Default:** No. Persistent inline feedback is accessible, survives long enough
to read, and does not add a second notification mechanism.
