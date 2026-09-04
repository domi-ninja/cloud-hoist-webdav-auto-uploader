# 003 Connect and validate one Nextcloud account

Status: ready

Depends on: 002

## Outcome

The app can connect one Nextcloud account through Login Flow v2 or manual app credentials. Kotlin stores credentials for headless workers and exposes only non-secret account health to React Native.

## Work

- Normalize and validate the user-entered server URL without guessing arbitrary subpaths.
- Implement Login Flow v2: create the login request, open the returned URL in the system browser, poll the exact endpoint, handle expiry and cancellation, and treat the returned server URL as authoritative.
- Implement the fallback form for server URL, username, and app password. Label it as an app password and reject an empty value. Never ask for a main account password.
- Call the OCS user endpoint after authentication to resolve the DAV user ID rather than assuming `loginName` is the ID.
- Query OCS capabilities and persist the fields needed by transfer code, including chunk support and advertised limits.
- Store the app password in Kotlin-owned encrypted storage backed by Android Keystore so a worker can authenticate while React Native is not running.
- Keep account metadata separate from the secret. Never return the app password over the Expo module after storage.
- Use Android's TLS trust store. Surface certificate failures as a blocker and provide no bypass.
- Support replacing the one configured account only through the confirmed sign-out flow defined in ticket 013.

## Acceptance criteria

- Login Flow v2 succeeds against a real Nextcloud test server with two-factor authentication enabled.
- Manual app credentials reach the same validated account state.
- Cancelled and expired browser login attempts leave no stored credentials.
- The stored account uses the resolved DAV user ID and authoritative server URL.
- Invalid credentials, maintenance mode, unsupported response bodies, redirects, and certificate errors produce distinct safe error codes.
- Logs and module responses contain no password, token, authorization header, or login polling token.
- After the React Native process dies, a Kotlin test path can still load the account credential and make an authenticated capability request.

## Verification

- Add unit tests for URL normalization, polling states, JSON decoding, and secret redaction.
- Test both login methods on the emulator against a disposable account.
- Use the local ignored `test-creds.tct` values for the emulator's manual-app-credential acceptance path. Load them only through the debug test harness; never hard-code, print, snapshot, or bundle them.
- Inspect logs during success and failure to confirm secrets never appear.

## Not in this ticket

- Multiple accounts
- OAuth providers outside Login Flow v2
- Custom certificate pinning
- Remote folder browsing

## Open question

**Question:** Should a manual credential login accept a username and app password when Login Flow v2 is available?

**Default:** Yes. Keep the manual path behind a secondary action for self-hosted setups where browser login or redirects fail.
