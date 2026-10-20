# UX audit

Date: 2026-09-05

Scope: Sources, Activity, Settings, source setup, account access, and shared UI components.

Reference: [Mobile UX guidelines](./MOBILE_UX_GUIDELINES.md)

## Verdict

The app spends too much space proving that each thing is separate. Panels, 16 dp gaps, full-width buttons, headings, and explanatory sentences all repeat the same hierarchy.

The fix is not smaller text or smaller tap targets. The fix is a flatter information model:

- compact top app bar
- short status summary
- list rows instead of cards
- one add action
- pull-to-refresh plus a small refresh action
- per-row detail and overflow actions
- account and settings in the top-right menu

## What the current code does

The waste comes from a few reusable choices:

- `Panel` adds 16 dp padding and a 16 dp gap between every child.
- `ActionButton` adds 16 dp padding on all sides and normally occupies the full width available.
- Screens use 16 dp gaps between nearly every top-level child.
- Source cards repeat the same 16 dp gap internally.
- Source cards expose scan, destination, options, reset, and remove as stacked text buttons.
- The Sources footer exposes four stacked full-width actions.
- Activity entries use 16 dp between a primary line and its supporting line.
- Settings uses filled panels for ordinary switch rows, account details, diagnostics, and About.
- Visible button text often repeats the full accessibility action name.

Relevant code:

- [`src/components/ui.tsx`](../src/components/ui.tsx)
- [`src/app/index.tsx`](../src/app/index.tsx)
- [`src/features/sources/SourceCard.tsx`](../src/features/sources/SourceCard.tsx)
- [`src/app/activity.tsx`](../src/app/activity.tsx)
- [`src/app/settings.tsx`](../src/app/settings.tsx)

## Sources screen

### Current problems

- The app name consumes a row even though the launcher and task already identify the app.
- Engine state and queue state sit in a padded panel despite being two short lines.
- "Sources" is followed by a sentence that restates the source count and product capability.
- Every source is a large card with status, destination, two normal actions, a separator, and an options action.
- The footer stacks "Add watch folder," "Add Camera or Screenshots," "Scan now," and "Pause uploads."
- Pull-to-refresh already scans, so the full-width scan button duplicates it.

### Target structure

```text
Sources                 [refresh] [menu]
Idle · 3 sources · 0 queued
----------------------------------------
Camera                              [on]
2h ago · /Cloud Hoist/Camera  [⋮]
----------------------------------------
Screenshots                         [on]
5m ago · /Cloud Hoist/Shots   [⋮]
----------------------------------------
Receipts                            [off]
Paused · /Cloud Hoist/Receipts[⋮]

                                  [+]
```

### Rules

- Use "Sources" as the top app bar title.
- Put refresh and the top-right account menu in the app bar.
- Collapse engine and queue state into one line when idle.
- Keep blocked or paused state visible, but do not reserve a card for the normal state.
- Render each source as a 64 to 72 dp row.
- Keep the source name and switch on the first line.
- Show status and destination on one supporting line where width allows.
- Open source details when the row is tapped.
- Put maintenance actions in the row overflow menu.
- Use one add button. Its menu offers Folder, Camera, and Screenshots.
- Keep pull-to-refresh. The app-bar refresh icon is the discoverable duplicate.
- Move Pause or Resume into the app bar menu unless uploads are actively running.

## Source details

### Current problems

- Routine actions and dangerous maintenance actions share the same visual treatment.
- "Source options" expands more stacked buttons in place, making the list jump.
- "Change destination" consumes a full row even though the destination value is already visible.

### Target structure

- A child screen or bottom sheet owns source details.
- Use compact rows for Status, Local folder, Destination, and Last scan.
- Put Scan and Pause or Resume near the status only when relevant.
- Put Reset history and Remove source at the bottom under a clear danger section.
- Keep confirmation dialogs specific and short.

## Activity screen

### Current problems

- "Activity" appears as content instead of a compact app bar.
- Blockers, failures, transfers, and history each get their own heading and often another panel.
- A two-line activity entry uses a 16 dp internal gap.
- Empty sections remain visible as headings plus empty-state sentences.
- Clear history is a full-width destructive button at the bottom.

### Target structure

- Use one top app bar titled "Activity."
- Show only non-empty groups.
- Use flat rows with 4 dp between message and metadata.
- Put failures first and use a compact Retry action beside the group heading.
- Hide the Transfers group when there are no active transfers.
- Keep pagination automatic or use the short label "Older."
- Put Clear history in the top-right overflow menu.
- Keep pull-to-refresh.

## Settings and account

### Current problems

- Settings occupies a primary bottom-navigation destination even though it is infrequent.
- The account appears both in the Sources top-right menu and again as a full settings panel.
- "Sign out and remove local data" is useful as an accessibility label but too long for a visible action.
- Diagnostics needs a paragraph before a routine Share action.
- About uses a full panel for two lines.

### Target structure

- Remove Settings from bottom navigation.
- Put Account and Settings in the top-right menu.
- Use a normal settings list with 48 to 56 dp rows.
- Keep transfer rule labels short and show switches at the trailing edge.
- Use "Sign out" as the visible label. Explain local-data removal in the confirmation dialog.
- Use "Share diagnostics" without the preceding paragraph. Put the privacy explanation in the share confirmation or diagnostics detail view.
- Use a compact About row that opens license and compatibility details.

## Shared components

### Replace `Panel`

Create components with specific jobs:

- `ListSection` for a heading plus flat rows
- `ListRow` for primary text, optional supporting text, and trailing content
- `StatusBanner` only for blocked, failed, or paused global state
- `IconAction` with a 48 dp hit area and a 20 to 24 dp icon
- `OverflowMenu` for infrequent actions

Do not replace one generic container with five generic wrappers. Each component should remove repeated layout code and enforce density.

### Replace `ActionButton` as the default

Keep a filled text button for the one primary action in a flow. Add compact alternatives:

- icon-only app-bar action
- inline text action
- list-row action
- overflow menu item
- destructive menu item followed by confirmation

All variants keep a 48 dp touch target. Their visible background does not need to fill that target.

## Concrete density limits

These are project limits, not suggestions:

| Element | Limit |
| --- | --- |
| Compact screen margin | 16 dp |
| Gap within one row | 4 to 8 dp |
| Gap between sections | 12 to 16 dp |
| Routine row height | 56 to 72 dp |
| Icon size | 20 to 24 dp |
| Interactive hit area | at least 48 by 48 dp |
| Visible action label | one to three words |
| High-emphasis actions | at most one per screen |
| Supporting lines per row | at most one by default |
| Full-width buttons on Sources | zero in the normal state |
| Source actions visible in list | switch plus overflow |

## Acceptance checks for the redesign

- The opening Sources viewport shows the top app bar, global status, and at least three source rows on the reference emulator.
- The normal Sources state has no stack of full-width buttons.
- Pull-to-refresh scans all enabled sources.
- A 48 dp app-bar refresh target offers the same scan action.
- The add action opens Folder, Camera, and Screenshots choices.
- Every source row exposes enabled state, recent status, destination, and overflow without expanding the row.
- Account and Settings are reachable from the top-right menu.
- Bottom navigation contains Sources and Activity only.
- Visible action labels use no more than three words unless a platform term requires more.
- Accessibility labels retain the full action and object name.
- Activity hides empty groups.
- Errors appear next to the source or transfer that caused them.
- Large text does not clip controls or make actions unreachable.
- Light and dark themes preserve contrast without adding borders around every group.

## Implementation order

1. Replace the shared spacing and action defaults.
2. Build the compact top app bar and top-right menu.
3. Convert source cards into list rows and move actions into details or overflow.
4. Replace the Sources footer with one add action.
5. Flatten Activity into conditional list sections.
6. Move Settings out of bottom navigation and flatten its panels.
7. Run emulator checks at default and large font sizes.
