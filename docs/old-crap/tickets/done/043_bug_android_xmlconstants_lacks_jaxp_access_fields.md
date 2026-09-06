# 043 Android XMLConstants lacks desktop JAXP access fields

Status: complete

Found while working on: 004

## Bug

The initial DAV parser used `ACCESS_EXTERNAL_DTD` and
`ACCESS_EXTERNAL_SCHEMA`. Those desktop JAXP constants are absent from the
Android compile stubs used by the native module.

## Impact

The DAV folder client does not compile for Android.

## Fix

Remove the unavailable factory attributes. Keep doctype declarations and both
external entity forms disabled through parser features, then prove a doctype
payload is rejected in a unit test.

## Acceptance criteria

- The native module compiles against Android API 36.
- A DAV response containing a doctype fails as an unsupported response.
- Ordinary namespaced DAV multistatus XML still parses.

## Open question

**Question:** Should we add an XML parser dependency for identical JVM and
Android behavior?

**Default:** No. The platform DOM parser is enough once tests cover its locked
configuration.
