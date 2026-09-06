# 087 Default new sources to an app folder

Status: done

Depends on: 004, 011, 083

## Outcome

New sources upload to `/WebDAV Auto Upload` by default. The app creates that folder before saving the source instead of directing uploads into the Nextcloud account root.

## Work

- Add the default remote folder name to the project configuration.
- After local source selection, continue directly to review with `/WebDAV Auto Upload` selected.
- Replace the review screen's Back action with Change destination.
- Keep the remote folder browser available for users who want another location.
- Allow `/` only when the user explicitly selects it in the browser.
- Create each selected destination path segment before committing the source.
- Treat an existing remote folder as success. The native DAV client already handles an existing collection idempotently.
- Stop source creation and show the DAV error if the folder cannot be created.

## Acceptance criteria

- Camera, Screenshots, and selected-folder sources all default to `/WebDAV Auto Upload`.
- The review screen shows the default destination before any server mutation.
- Start auto upload creates the remote folder and stores it as the source destination.
- Reusing an existing `/WebDAV Auto Upload` folder succeeds.
- Change destination still supports existing folders, new folders, and an explicit root selection.
- Cancelling setup before save does not create a remote folder.

## Verification

- Add focused tests for the configured default folder and destination-path creation order.
- Run TypeScript, Expo lint, and Jest.
- Build and install the release APK.
- Start a new Camera source on the connected emulator account.
- Confirm review defaults to `/WebDAV Auto Upload`.
- Save the source and verify through WebDAV browsing that the folder exists and the source targets it.
- Remove the temporary acceptance source after verification without deleting the remote folder.

## Open question

**Question:** Should each source get a child folder beneath `/WebDAV Auto Upload`?

**Default:** No. Use one dedicated app folder for now. Users can choose separate destinations when filename overlap matters.
