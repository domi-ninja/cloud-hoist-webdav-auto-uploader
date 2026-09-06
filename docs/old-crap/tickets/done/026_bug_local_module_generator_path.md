# 026 Correct the local Expo module destination

Status: complete

Found while working on: 002

## Bug

`create-expo-module --local` reported and used `modules/my-module` even though the command included `modules/webdav-upload-engine` as its destination.

## Impact

The generated local module has a placeholder directory name that does not match the project or native engine.

## Fix

Move the generated module to `modules/webdav-upload-engine`, verify local autolinking uses the new path, and document the reliable generator invocation.

## Acceptance criteria

- No `modules/my-module` path remains.
- Expo autolinking finds `WebDavUploadEngine` under `modules/webdav-upload-engine`.
- The native Android build consumes the renamed module.

## Open question

**Question:** Should setup wrap `create-expo-module` for future local modules?

**Default:** No. This app needs one local engine module; record the workaround and avoid adding a wrapper for a one-time scaffold operation.
