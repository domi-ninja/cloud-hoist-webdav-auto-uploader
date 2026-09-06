# 072 Redact complete authorization header values

Status: done

Found while working on: 013

## Bug

The first generic secret-value redactor stopped at whitespace. For an
`Authorization: Basic <credential>` line it replaced `Basic` but left the fake
credential sentinel after it.

## Impact

Future diagnostic context containing a raw authorization header could have
leaked credentials despite passing through the second redaction layer.

## Fix

Redact authorization headers as complete lines before applying the generic
secret, URL, content-URI, and Android-path patterns. Keep distinct fake
sentinels in the test so every sensitive fragment must disappear.

## Acceptance criteria

- Basic authorization credentials do not survive redaction.
- Passwords, credentialed URLs, query tokens, content URIs, and Android paths
  remain covered.
- The full native unit suite passes.
