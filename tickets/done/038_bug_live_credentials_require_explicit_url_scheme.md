# 038 Live credential loader rejects a bare server host

Status: complete

Found while working on: 003

## Bug

The local acceptance credential file can identify a Nextcloud server by host,
while the production account boundary requires an absolute HTTPS URL. The host
runner passed the bare value unchanged and received
`ERR_ACCOUNT_INVALID_SERVER_URL`.

## Impact

Valid local test credentials cannot reach the live connection check unless the
developer rewrites the private file.

## Fix

Normalize a scheme-less server value to HTTPS in the host-only credential
loader. Reject any resulting URL that is not HTTPS or has no hostname before it
crosses the ADB boundary.

## Acceptance criteria

- A bare host becomes an HTTPS server URL.
- HTTP and malformed server values fail locally with a generic error.
- The script never prints either the raw or encoded credential values.

## Open question

**Question:** Should the app itself add HTTPS to scheme-less manual input?

**Default:** No. Keep production input strict and make this compatibility rule
specific to the private acceptance-file loader.
