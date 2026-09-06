# 032 Give account actions stable accessibility labels

Status: complete

Found while working on: 003

## Bug

The account screen exposed visible text inside each `Pressable`, but the action
nodes had no explicit accessibility labels. UI Automator could find a nested text
node without reliably activating its pressable parent.

## Impact

Automated acceptance could silently miss the connect action, and assistive tools
had to infer action names from descendant layout.

## Fix

Give each account action an explicit label matching its concise visible text and
target the actionable accessibility node in device tests.

## Acceptance criteria

- Browser, fallback, cancel, connect, and verify actions have stable labels.
- UI Automator activates the pressable node rather than a nested text node.
- Visible labels and accessibility labels do not diverge.

## Open question

**Question:** Should these actions also receive test-only resource IDs?

**Default:** No. Human-readable accessibility labels cover both users and the
small device suite without adding a parallel test identifier vocabulary.
