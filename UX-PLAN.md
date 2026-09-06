# UX improvement plan

Status: implemented on 2026-09-06.

Based on the code review of Sources, Activity, Settings, and their supporting dialogs on 2026-09-06. The Paper control migration and collapsed/active filters were reviewed on the Android emulator in light and dark modes. Populated queues and large-text layouts still need a broader review.

## Scope and design constraints

- Keep the three tabs and one-way automatic upload scope.
- Keep uniform text sizing and consistent spacing. Use placement, grouping, and weight for hierarchy.
- Prefer compact actions beside the item they control. Avoid full-width buttons unless the action needs that priority.
- Reuse existing editors and dialogs rather than adding menus.
- Keep `PLAN.md` as the product decision record. This file proposes UX work; it does not override those decisions.

## Current screen inventory

| Screen | Existing content and actions | Main friction |
| --- | --- | --- |
| Sources | Account connection, global status, queue counts, source switches, scan/edit/maintenance actions, source editor, global scan and pause controls | Tall source cards push global actions below the list; waiting and recovery states need clearer explanations |
| Activity | Blockers, repair links, file thumbnails and presence labels, transfer status, pagination, retry failures, history clearing | Troubleshooting and file browsing compete for attention; recovery controls can be buried or missing |
| Settings | Account settings, network/battery/charging rules, diagnostic sharing, app information | Rules do not explain their combined effect or why current uploads are waiting |

## Phase 1: fix misleading behavior

- [x] Honor the Enabled switch when creating a source, or show it only when editing. The creation request currently omits the value and the native engine creates the source enabled.
- [x] Replace Activity's two-stage expansion with one "Show 20 more" action that fetches the next page immediately. Hide it when there are no more files.
- [x] Determine Retry failed availability from all unresolved failures, not only loaded inventory pages. Place the action beside Needs attention.
- [x] Handle the worker's waiting reason in Sources status. Keep pause, active work, waiting, and blockers understandable when states coexist.

Acceptance checks:

- A source cannot silently start enabled after the user turns its creation switch off.
- One pagination tap loads more files, with loading feedback and no extra expansion step.
- A failure outside the first inventory page still exposes Retry failed.
- Waiting work shows the available reason instead of falling back to a scan timestamp.

## Phase 2: simplify Sources

- [x] Move global Scan and Pause/Resume into a compact group with the global status, above the source list.
- [x] Place Add source beside the Sources heading.
- [x] Shorten source cards to name and enable switch, status, local-to-remote folder mapping, and compact scan/edit actions.
- [x] Move reset-history and remove-source actions into the existing source editor, preserving their confirmations.
- [x] Make the issue summary open the relevant problems in Activity.
- [x] Give the connected-but-empty state Camera, Screenshots, and Choose folder actions, with a short explanation of automatic uploads. Omit scan/pause controls until a source exists.
- [x] Reorder source setup to local folder, destination, and collision behavior. Keep the source name editable without making it the main setup task.

Acceptance checks:

- Global controls appear before the first source regardless of source count.
- Each source's origin, destination, and state are readable without opening its editor.
- Setup starts with choosing what to upload.
- Permission repair remains visible on affected sources.
- Maintenance actions remain available with clear consequences.

## Phase 3: make Activity useful for recovery

- [x] Lead with current transfers and actionable problems; place the complete file inventory below them.
- [x] Add a compact status filter. Add a source filter when multiple sources exist. Filter the inventory across pages, not just the currently loaded rows.
- [x] Replace generic "Repair in Sources" navigation with a specific action that opens or focuses the affected source or account repair flow.
- [x] Include the source name in partial inventory loading errors so the user knows which destination could not be checked.
- [x] Remove or replace the remote-only down arrow, which suggests downloading. Keep explicit presence text.
- [x] Move Clear completed history into Settings and retain the explanation that it removes transfer records while leaving files and the inventory intact.

Acceptance checks:

- Users can reach an available repair directly from its problem description.
- Retry remains near the problems even with a long file list.
- Filters include matching files beyond the first loaded page.
- Presence indicators do not imply a download feature or guarantee that local and remote contents are identical.
- Clearing history communicates what disappears and what remains.

## Phase 4: explain Settings and automatic behavior

- [x] Show the server hostname alongside the connected account name.
- [x] Add a short summary of the combined transfer rules, such as "Uploads wait for an unmetered connection and charging."
- [x] Show the actual current waiting reason on Sources when available. Do not infer a live blocker solely from an enabled setting; extend engine reporting if necessary.
- [x] Explain automatic scanning and possible Android scheduling delays without promising an exact upload time.
- [x] Make Share diagnostics a compact secondary action, preserving the explanation of excluded private details.
- [x] Add the app version to About.
- [x] Provide the completed-history clearing action moved from Activity.

Acceptance checks:

- Users can identify the connected server without opening a dialog.
- Enabled rules and current waiting conditions are clearly distinguished.
- Users understand that automatic work can be delayed by Android.
- App version and diagnostics are easy to find without dominating the screen.

## Verification and implementation notes

### Icon controls and component library correction

- [x] Introduce React Native Paper controls and Expo Material Community Icons, with light/dark themes.
- [x] Hide Activity filters behind a filter icon beside Files. Indicate active filters when collapsed.
- [x] Use compact icon buttons for scan, pause/resume, add, edit, retry, share, and maintenance actions. Keep accessibility labels and long-press tooltips.
- [x] Replace homemade collision radios with Paper radios and use Paper switches, buttons, chips, and panels.
- [x] Remove the exact acceptance-test source during fixture cleanup before its destination is deleted. Include the underlying inventory error in the UI.

### Checks

- Read the exact Expo v57 documentation before application code changes, as required by `AGENTS.md`.
- Add focused tests for changed behavior, especially source creation, pagination, and failure visibility. Avoid tests that merely mirror layout markup.
- Run the relevant project checks documented in `README.md` for application changes.
- Review on a phone-sized Android emulator or device in light and dark modes. Check empty setup, several sources, long paths, active transfers, waiting, permission/account failures, and multiple inventory pages.
- Check accessibility labels, touch targets, text wrapping, and larger system text after compacting controls.
- Treat accurate waiting reasons, direct repair navigation, and inventory filtering as potentially requiring engine or route changes, not just copy edits.
