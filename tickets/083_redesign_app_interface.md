# 083 Redesign the app interface

Status: in progress

Depends on: 012, 081, 082

## Outcome

The app reads as a focused Android upload utility instead of a wireframe. Upload state and the next useful action are obvious. Account details and infrequent account actions live in a real hamburger menu at the upper-right.

## Design diagnosis

- Borders currently wrap cards, buttons, folder rows, switches, and forms. Nothing has priority because everything looks equally actionable.
- The Sources screen gives four source actions the same weight even though scanning and fixing a blocker matter more than changing history.
- The connected account occupies permanent screen space despite being reference information after setup.
- Activity repeats completed uploads in both Transfers and Recent activity.
- Settings imitates switches with large bordered buttons and text labels. Android already has a clearer control for this.
- Folder browsing renders each folder as a separate outlined card, which makes a simple list hard to scan.
- Destructive and rare actions sit beside everyday actions instead of staying visually quiet.

## Direction

Use an industrial utility style. The interface is dense, calm, and direct. A restrained stone canvas and darker panels carry structure. Green marks active state and primary actions. Red appears only for errors and destructive actions.

Keep the project's single `text-base` size and `p-4` spacing unit. Use font weight and color for hierarchy. Do not add gradients, shadows, decorative icons, floating buttons, or nested navigation.

The source ledger is the visual anchor. Each source should read like a compact status record, not a settings form.

## App-wide work

- Add shared panel and button components so each action tone has one implementation.
- Use filled green buttons for the primary action in a task.
- Use quiet rows or text actions for secondary and destructive commands.
- Use panel backgrounds for grouping. Reserve borders for separators, inputs, and focused selection state.
- Keep pressed and disabled states visible.
- Preserve system light and dark mode, font scaling, accessibility roles, labels, and live regions.
- Keep the existing text-only bottom tabs. The selected tab remains green.

## Sources screen

- Keep the app name and current engine status at the top.
- Replace the account portrait block with a hamburger button at the upper-right.
- Open a dismissible menu from that button. Show the Nextcloud instance icon, account name, hostname, account-check state, retry action when needed, and a Settings shortcut inside it.
- Close the menu through the Android back button, backdrop press, repeated hamburger press, or a menu action.
- Show the queue summary near the Sources heading.
- Render each source in a quiet panel.
- Put source name, status, destination, and an Android switch in the main source row.
- Keep restore permission prominent when a source is blocked.
- Make Scan source and Change destination the visible source actions.
- Move Reset history and Remove source into a clearly separated maintenance area inside the card. They must not compete with scanning.
- Keep pull-to-scan and the global Scan now button.
- Keep pause or resume available, but secondary to scanning.
- Use Add source as a clear action after the existing source list.

## Activity screen

- Show queued, uploading, and failed jobs under Transfers.
- Do not repeat uploaded jobs there. Completed uploads belong under Recent activity.
- Group transfer and activity rows in panels with separators instead of individual bordered cards.
- Keep blockers and unresolved failures above transfers.
- Keep Retry failed beside unresolved failures.
- Place Clear completed history after the completed activity it affects.
- Keep pull-to-refresh and pagination.

## Settings screen

- Replace the fake switch rows with native Android switches.
- Keep transfer rules in one panel with row separators.
- Present Account, Diagnostics, and About as simple sections.
- Keep sign-out red and visually separate from ordinary controls.
- Keep diagnostic copy explicit about excluded private data.

## Setup and folder selection

- Use the same panels and action hierarchy as the main screens.
- Render local source choices and remote folders as list rows with separators.
- Preserve Cancel on every setup step.
- Keep Continue, Use this folder, and Start auto upload as the one primary action for their step.
- Keep Back and Cancel quiet.
- Show radio selection clearly without turning both choices into large bordered cards.

## Acceptance criteria

- The Sources header has an actual hamburger button at the upper-right.
- Opening the hamburger reveals the connected account and live verification state in a menu overlay.
- The account no longer consumes permanent space on the Sources screen.
- Each screen has one obvious primary action at most within a task section.
- Native switches control source enabled state and all transfer rules.
- Uploaded jobs appear once, under Recent activity.
- Routine rows use panel backgrounds and separators instead of repeated full outlines.
- Pull-to-scan, Scan now, account verification, source editing, setup cancellation, retry, pause, diagnostics, and sign-out still work.
- Light mode, dark mode, enlarged font scaling, scrolling, and Android back dismissal remain usable.
- The release build installs and runs on the project emulator.
- Sources, Activity, Settings, the account menu, and a source setup step are visually inspected on the emulator after the release build.

## Verification

- Run TypeScript, Expo lint, and Jest.
- Build and install the release APK on the API 36 emulator.
- Inspect all three tabs at the emulator's current enlarged font scale.
- Open and dismiss the hamburger through both the backdrop and Android back button.
- Toggle a transfer rule twice and confirm its final native value is unchanged.
- Trigger a pull-to-scan and confirm the status refreshes.
- Start source setup, advance if permissions allow, and confirm Cancel remains available.
- Run deep-link and privacy checks.

## Not in this ticket

- A custom icon library
- Animated navigation
- File thumbnails or previews
- Per-source network rules
- Search, sorting, or queue reordering
- A theme picker

## Open question

**Question:** Should the account menu replace the Settings account section entirely?

**Default:** No. Keep the menu as the quick account summary and route to Settings for destructive account actions such as sign-out.
