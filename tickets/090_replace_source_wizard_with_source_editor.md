# 090 Replace the source wizard with a source editor

Parent: 037

## Outcome

Sources are clear, editable backup jobs. Adding or editing one opens a dedicated modal page with the full configuration in review order instead of walking through the current setup wizard.

## Work

- Keep the Sources screen as the list of configured backup folders.
- Open the same source editor for both Add source and Edit source.
- Put the local folder, remote folder, source name, enabled state, and basic source settings on one scrollable page.
- Order the fields so the user can read the page from source to destination, then behavior.
- Let local and remote folder rows open their existing native picker and remote browser without turning the editor itself into a multi-step flow.
- Put Save at the upper-right and repeat it after the final field.
- Disable both Save controls while saving and make them submit the same form state.
- Keep Cancel and Android back dismissal. Confirm before discarding edits only when values changed.
- Open existing sources in place with their persisted values. Do not make users remove and recreate a source to change ordinary settings.
- Keep permission repair, manual scan, upload-history reset, and removal available from the source's list entry or editor without mixing them into the normal save action.

## Acceptance criteria

- Add source opens a dedicated modal editor rather than the current staged setup UI.
- Editing a source opens the same editor with every persisted value populated.
- Local folder, remote folder, name, enabled state, and basic source settings are visible in one scrollable form.
- Save is available at the upper-right and at the bottom of the form.
- Either Save control persists the same validated values and closes the editor after success.
- A failed save leaves the editor open, preserves its values, and shows the error beside the relevant control or Save action.
- Cancel and Android back leave a clean form immediately and protect changed values from accidental loss.
- The editor remains usable with enlarged font scaling and the keyboard open.

## Verification

- Add focused tests for create mode, edit-mode hydration, dirty-form dismissal, and the shared Save action.
- Run TypeScript, Expo lint, and Jest.
- Build and install the release APK.
- Create a source, edit each persisted field, save from the top action, reopen it, then save another change from the bottom action.
- Check the modal with enlarged font scaling and Android back.

## Not in this ticket

- New collision behavior from ticket 091
- Camera and Screenshots presets from ticket 092
- Activity thumbnails or remote file discovery
- A second level of advanced settings

## $grilling

❓ **Q1** - **Where should destructive actions live?**: Should Reset upload history and Remove source appear at the bottom of the editor, or remain behind Source options on the source row?

➡️ Keep them behind Source options on the source row. The editor should describe the backup job, not become a maintenance drawer.

❓ **Q2** - **What counts as a basic source setting?**: Besides the collision behavior in ticket 091, should this first editor include any setting that does not already exist per source?

➡️ No. Move existing settings first and add only the collision choice. More settings need a concrete use case.
