# 004 Browse and create remote folders

Status: in progress

Depends on: 003

## Outcome

Source setup can browse directories under the authenticated user's Nextcloud file root, create a folder, and return a canonical destination path without exposing a general file browser.

## Work

- Add Kotlin DAV operations for depth-one folder listing, folder metadata, and `MKCOL`.
- Encode the DAV user ID and every path segment separately. Never URL-encode path separators into a single opaque string.
- Decode multistatus XML defensively, including namespaces, escaped names, non-ASCII names, spaces, and server error responses.
- Return folders only. Ignore files and preview metadata.
- Represent the selected destination as normalized path segments rather than a user-authored URL.
- Create missing folders one level at a time and treat an already-existing directory as success.
- Build the minimal React Native picker with back navigation, loading, empty, retry, and create-folder states.
- Keep the picker inside source setup. Do not add rename, delete, download, share, or file preview actions.

## Acceptance criteria

- The picker starts at the authenticated DAV root and cannot navigate above it.
- It lists and enters folders with spaces, Unicode, reserved URL characters, and nested paths.
- A user can create a folder and select it without manually typing a DAV URL.
- Permission, quota, authentication, certificate, and server errors remain distinct.
- The returned path is stable and reusable by the native transfer engine.
- Folder listing and XML parser tests use captured, redacted fixtures for common Nextcloud responses.

## Verification

- Run parser and path-encoding unit tests.
- Browse and create folders against the disposable Nextcloud account.
- Confirm the UI never displays or logs credentials or raw authorization errors.

## Not in this ticket

- Generic WebDAV interoperability
- File management
- Shared-file views
- Local folder selection

## Open question

**Question:** Should users be able to choose the DAV root itself as an upload destination?

**Default:** Yes. Allow it, but suggest creating a dedicated folder so the app does not impose a remote layout.
