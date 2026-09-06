# 040 Emulator cannot resolve the host-only Nextcloud name

Status: complete

Found while working on: 003

## Bug

The Android emulator resolves public names but cannot resolve the test
Nextcloud hostname available through the development host's resolver.

## Impact

The live account acceptance path fails at DNS before it can validate the real
credentials, encrypted storage, or process-death reload.

## Fix

Resolve the test hostname on the host and pass the chosen address to the
debug-only provider. Its OkHttp client maps only that hostname to that address,
so the request still uses the original URL, HTTP host, and TLS server name.

## Acceptance criteria

- The emulator connects to the host-resolved address.
- TLS continues validating the original server hostname.
- Production builds keep Android's normal DNS behavior.
- Neither the hostname, resolved address, nor encoded values appear in script
  output.

## Open question

**Question:** Should the app ship a custom DNS override?

**Default:** No. This is debug-only test plumbing for a development network.
Production must use Android's configured resolver.
