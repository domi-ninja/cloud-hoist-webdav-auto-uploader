# 077 Diagnostic redactor misses filename fields

Status: in progress

Found while: auditing ticket 013 redaction coverage

## Problem

The diagnostic report deliberately excludes filenames before serialization, but its required second redaction pass does not remove a future or malformed `fileName` field. It also treats only `Authorization` as a sensitive HTTP header, leaving cookie headers insufficiently defended.

## Fix

- Redact keyed filename and local or remote path values.
- Redact `Cookie` and `Set-Cookie` header lines alongside authorization headers.
- Cover nested exception-shaped text containing URLs, tokens, Android URIs, paths, filenames, and headers in one regression test.

## Acceptance criteria

- Standalone keyed filenames do not survive redaction.
- Authorization and cookie header values do not survive redaction.
- Nested error text retains useful non-private structure while removing private values.
