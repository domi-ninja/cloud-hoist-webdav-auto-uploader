# 064 Bug: Android DAV parser rejects a security feature

Status: done

## Found while

Running the chunk resume and byte-integrity acceptance test on the API 36 emulator.

## Symptom

Parsing a valid Nextcloud `PROPFIND` response throws `ParserConfigurationException` before the XML is read.

## Cause

Android's Harmony `DocumentBuilderFactory` does not implement the Apache `disallow-doctype-decl` feature accepted by the desktop JVM used for unit tests. Parser configuration happened outside the existing error mapping.

## Fix

- Reject document type declarations explicitly before parsing.
- Apply external-entity parser features when the platform supports them.
- Share the portable parser between folder browsing and chunk reconciliation.
- Map all remaining parser setup and document errors to the existing unsupported-response failure.

## Acceptance criteria

- Valid namespaced DAV XML parses on Android API 36.
- Doctype payloads remain rejected.
- Folder browsing and chunk reconciliation use the same hardened parser.

## Open question

**Question:** Should the project add a separate XML library for identical JVM and Android behavior?

**Default:** No. The small platform-compatible wrapper is enough for the narrow DAV responses this app reads.
