# 044 Remote folder effect mutates state synchronously

Status: complete

Found while working on: 004

## Bug

The picker effect called an async helper that changed loading state before its
first `await`. React 19's hooks lint treats that as a synchronous state update
inside an effect.

## Impact

Lint fails, and a slow response from a previous folder can race a newer
navigation request.

## Fix

Start the native request directly in the effect, apply results only from its
promise callback, and ignore the response after the path changes or the picker
unmounts. Navigation actions set loading state before changing the path.

## Acceptance criteria

- Hooks lint passes without suppression.
- Initial and nested folder loads still show loading state.
- A stale request cannot replace the current folder list.

## Open question

**Question:** Should ticket 004 add TanStack Query now?

**Default:** No. Ticket 011 owns shared query state. A small cancellable effect is
enough for this isolated picker.
