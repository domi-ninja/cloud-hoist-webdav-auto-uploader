# 082 Let users cancel every source setup step

Status: complete

Found while working on: 012

## Bug

The initial local-source picker and remote-destination picker omit the Cancel
action when adding a source. Cancel appears only on the final review step.

## Impact

Users can open Add source and become stuck in setup unless they finish enough
steps to reach review or restart the screen.

## Fix

Show the same Cancel source setup action on every setup step when an existing
Sources screen supplied a cancel callback.

## Acceptance criteria

- Add source can be cancelled before choosing local files.
- Add source can be cancelled while browsing remote folders.
- First-time setup still requires creating a source and does not offer a route
  into an unusable empty app.

## Open question

**Question:** Should Android's Back gesture also cancel the entire setup?

**Default:** No. Back should continue to move one setup step backward. The
visible Cancel action exits the complete flow without overloading navigation.
