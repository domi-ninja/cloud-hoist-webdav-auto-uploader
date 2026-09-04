# 062 Bug: chunk coordinator refactor drops capability scope

Status: done

## Found while

Compiling the durable chunk checkpoint coordinator and its queue integration.

## Symptom

The native module fails to compile because the extracted chunked-upload method refers to an account capability variable owned by its caller.

## Cause

The reconciliation block moved into a private method without moving or passing the local capability snapshot it needs.

## Fix

Read the immutable capability snapshot from the credential inside the extracted method.

## Acceptance criteria

- The chunk coordinator compiles after extraction.
- Coordinator and queue tests run successfully.

## Open question

**Question:** Should the caller pass the capability snapshot explicitly?

**Default:** No. The credential is already required and is the single source of account capabilities.
