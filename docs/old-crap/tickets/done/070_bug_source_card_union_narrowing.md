# 070 Narrow source-card bridge unions before callbacks

Status: done

Found while working on: 012

## Bug

The first source-management card accessed discriminated-union fields through
repeated object properties and an untyped `find` callback. TypeScript correctly
rejected `worker.jobId` and `blocker.permission` because the narrowed variant was
not preserved across those expressions.

## Impact

The source-management slice could not pass the required typecheck, and weakening
the bridge types would have hidden invalid native states from the UI.

## Fix

Bind the worker before checking its state and use an explicit predicate that
narrows the matching blocker to the permission variant.

## Acceptance criteria

- Source status reads `jobId` only from an uploading worker.
- Permission repair reads `permission` only from a permission blocker.
- The project passes TypeScript without casts or `any`.
