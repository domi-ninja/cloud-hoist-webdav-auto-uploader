# 061 Bug: chunk listing request body does not compile

Status: done

## Found while

Compiling the Nextcloud chunked-upload v2 transport.

## Symptom

Kotlin rejects the empty `PROPFIND` request body because it does not implement OkHttp's required `contentType` member.

## Cause

The anonymous `RequestBody` implemented its length and writer but omitted the nullable media-type method required by this OkHttp version.

## Fix

Return `null` explicitly from `contentType` for the empty DAV request body.

## Acceptance criteria

- The native module compiles.
- The chunk transport unit tests execute successfully.

## Verification

`./android/gradlew -p android :webdav-upload-engine:testDebugUnitTest` passes.

## Open question

**Question:** Should the empty request advertise an XML media type?

**Default:** No. The request has no XML payload, so an absent media type is accurate.
