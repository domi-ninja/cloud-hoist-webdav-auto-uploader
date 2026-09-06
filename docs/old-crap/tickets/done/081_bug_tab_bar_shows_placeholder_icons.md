# 081 Remove broken tab placeholder icons

Status: complete

Found while working on: 012

## Bug

The bottom tab bar reserves an icon slot without supplying icons. Android renders
an outlined placeholder glyph above every label.

## Impact

The primary navigation looks broken and wastes vertical space without helping
users distinguish the three plainly named tabs.

## Fix

Hide the unused icon slots, keep text labels at the app's standard type size,
and use the existing accent and muted colors for selected and idle tabs.

## Acceptance criteria

- Sources, Activity, and Settings render as text-only tabs.
- No missing-glyph or placeholder icon appears.
- The selected tab remains clear without relying on an icon.

## Open question

**Question:** Should the app add custom tab icons later?

**Default:** No. The three labels are short and unambiguous, and text-only tabs
fit the app's deliberately plain visual system.
