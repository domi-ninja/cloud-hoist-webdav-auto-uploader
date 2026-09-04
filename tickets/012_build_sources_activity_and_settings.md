# 012 Build Sources, Activity, and Settings

Status: in progress

Depends on: 004, 010, 011

## Outcome

The three-tab interface exposes source health, upload history, global controls, and the small set of settings agreed in the plan.

## Work

- Build Sources as the main screen with account health, global pause or resume, and a simple list of sources.
- Show one status line per source: uploading, waiting for network, paused, blocked, or last scanned at a concrete time.
- Show queued and failed counts without inventing a guaranteed next-run time.
- Add source enable or disable, scan now, edit destination, restore permission, reset history, and remove actions.
- Run a global scan when the user pulls the Sources screen to refresh. Keep the Scan now button as an explicit alternative.
- Build Activity with active, queued, blocked, failed, and completed items. Paginate the 30-day completed history instead of loading it all.
- Make blockers actionable. Account, source, and job blockers should open the correct repair flow.
- Add Retry failed from Activity. Do not add arbitrary per-item deletion or queue reordering.
- Build Settings with global network policy, battery-not-low, charging requirement, account summary, diagnostic export, about and license, and sign-out.
- Keep transfer rules global. Do not expose per-source network controls.
- Use the system light or dark setting and font scaling. Keep spacing and type scale deliberately small and consistent.
- Preserve useful screens across cold-start notification and deep-link navigation.

## Acceptance criteria

- Every engine and blocker state has a clear representation and a relevant next action.
- Pause, resume, scan, retry, source enable, and source disable update native state and invalidate the right queries.
- Pull-to-refresh and the global Scan now button use the same scan command and reload the engine snapshot before their progress state ends.
- Activity retains unresolved failures and shows only the retained 30-day completed window.
- Settings changes replace WorkManager constraints without deleting jobs.
- Cold-start deep links from notifications open the intended repair view.
- Empty, loading, offline, and native-module-error states do not strand the user.
- The interface contains no file browsing, download, sharing, decorative dashboard, or unrelated settings.

## Verification

- Add component tests for each source state, blocker action, settings mutation, pagination edge, and deep link.
- Drive fixture native snapshots through all screens before relying on live server failures.
- Manually check system theme, largest practical font scale, TalkBack focus, and small emulator viewport.

## Not in this ticket

- Theme picker
- Searchable permanent history
- Per-item queue surgery
- File previews or remote management

## Open question

**Question:** How should the Sources list order multiple configured sources?

**Default:** Keep creation order and pin blocked or actively uploading sources to the top only in the status summary, not by unexpectedly reshuffling the list.
