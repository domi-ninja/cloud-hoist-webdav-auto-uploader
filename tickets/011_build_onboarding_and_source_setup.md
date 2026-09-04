# 011 Build onboarding and source setup

Status: in progress

Depends on: 003, 004, 008, 009, 010

## Outcome

A new user can connect Nextcloud, create the first watched source, choose its remote destination and initial-import behavior, and reach a working Sources screen without encountering unrelated settings.

## Work

- Configure the three Expo Router tabs: Sources, Activity, and Settings.
- Add TanStack Query hooks around typed native snapshots and commands. Native invalidation events should invalidate the smallest relevant queries.
- Build the account connection step with Login Flow v2 as the primary action and manual app credentials as a secondary action.
- Build the source step flow: source type, local source or permission, remote folder, include-existing preview, and review.
- Offer Camera and Screenshots presets plus Choose folder.
- Request photo, video, notification, and SAF access only when the chosen path needs each permission. Explain denial and partial access without trapping the user.
- Show eligible existing file count and total size before the include-existing decision. Default to new files only.
- Let users create and choose the remote folder through ticket 004's picker.
- Commit the source configuration through one native command so partial setup cannot leave an enabled broken source.
- Allow backing out safely. Keep a successfully connected account even if source setup is cancelled.
- Use one typed string catalog for all user-facing copy.

## Acceptance criteria

- A fresh install reaches a configured source through the planned five-step path.
- Permission prompts appear only after an explanation tied to the selected source.
- Denied, limited, and permanently denied permission states have distinct recovery UI.
- Cancelling any step leaves no half-created source or queued jobs.
- Existing-file count and size match native discovery results.
- The completed source begins scheduling without reopening the app.
- Screen-reader labels, focus order, system font scaling, and system light or dark mode work through the flow.
- No screen receives or stores account secrets.

## Verification

- Add component tests for branching, cancellation, permission states, and validation.
- Run the whole flow on the emulator with Login Flow and manual credentials.
- Repeat setup with Camera, Screenshots, SAF, include existing, and new-files-only variants.

## Not in this ticket

- Multiple accounts
- Generic WebDAV setup
- Advanced per-source settings
- App appearance preferences

## Open question

**Question:** What destination should the remote picker suggest for a new source?

**Default:** Open at the DAV root and offer a one-tap suggestion to create `Auto Upload/<source name>`. Never create it until the user confirms.
