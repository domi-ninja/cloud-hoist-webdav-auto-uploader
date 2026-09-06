# 077 Diagnostic redactor misses filename fields

Status: completed

Found while: auditing ticket 013 redaction coverage

## Problem

The diagnostic report deliberately excluded filenames before serialization, but its required second redaction pass did not remove a future or malformed `fileName` field. It also treated only `Authorization` as a sensitive HTTP header, leaving cookie headers insufficiently defended.

## Resolution

- Redacted keyed filename and local or remote path values.
- Redacted `Cookie` and `Set-Cookie` header lines alongside authorization headers.
- Added nested exception-shaped text containing URLs, tokens, Android URIs, paths, filenames, and headers to the regression suite.

## Verification

`DiagnosticRedactorTest` passes both the existing aggregate case and the new nested private-context case.
