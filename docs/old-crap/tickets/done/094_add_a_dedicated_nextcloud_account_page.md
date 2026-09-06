# 094 Add a dedicated Nextcloud account page

Status: done

Parent: 037

## Outcome

The upper-right action is the connected Nextcloud instance icon. It opens a dedicated modal account page where the user can review and change account settings. Settings links to the same page.

## Work

- Replace the hamburger glyph with the current Nextcloud instance icon.
- Give the icon an explicit accessible label that includes the connected account name.
- Open a full modal page instead of the current anchored account menu.
- Show the display name, server hostname, verification state, last successful check, and Retry account check action.
- Put editable connection fields and account actions on this page. Reuse the existing account validation and app-password handling.
- Link to this page from the Account section in Settings.
- Keep one implementation of the page so the header icon and Settings cannot drift.
- Preserve sign-out confirmation and the warning that it removes local account data, sources, queue, and history without deleting phone or Nextcloud files.
- Support Save at the upper-right and at the bottom when editable values are present.
- Keep Android back and Cancel behavior consistent with the source editor.

## Acceptance criteria

- A connected account shows its Nextcloud instance icon at the upper-right instead of a hamburger.
- Pressing the icon opens the dedicated account modal page.
- The Settings account section links to that same page.
- Both entry points show live verification state and the same account fields and actions.
- Failed validation keeps the page open and preserves non-secret edits. The app does not repopulate a cleared app password.
- Saving changed connection details re-verifies them before replacing the stored account.
- Sign-out retains its destructive confirmation and cleanup behavior.
- The modal works with Android back, enlarged font scaling, and the keyboard open.

## Verification

- Add focused tests for both entry points, account hydration, verification errors, Save, and sign-out confirmation.
- Run TypeScript, Expo lint, and Jest.
- Build and install the release APK.
- Open the page from Sources and Settings, retry verification, edit and save account details against a disposable account, then verify Android back behavior.

## Not in this ticket

- Multiple connected Nextcloud accounts
- Per-source account selection
- Nextcloud server administration
- Changing the app password without re-entering it

## $grilling

❓ **Q1** - **Which account fields are editable?**: Letting users alter the server URL or username in place can invalidate every source and queued job because the app currently supports one account.

➡️ Treat server URL, username, and app password as one replacement-account form. Verify the new credentials first, then atomically replace the account while retaining sources only after an explicit confirmation.

❓ **Q2** - **Should the Settings account card duplicate details?**: Keeping the full summary there weakens the dedicated page and creates two places to maintain.

➡️ Show the instance icon, display name, and an Account settings row in Settings. Keep verification details and destructive actions on the modal page.
