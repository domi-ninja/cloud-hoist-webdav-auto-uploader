# 028 Correct the native module import depth

Status: complete

Found while working on: 002

## Bug

The fixture screen imported the root `modules` directory with one parent segment
too many, so TypeScript and ESLint could not resolve `WebDavUploadEngine`.

## Impact

The JavaScript checks failed before the native module could be exercised.

## Fix

Resolve the local module from `src/app` through `../../modules` and keep normal
module-resolution checks enabled.

## Acceptance criteria

- `pnpm typecheck` resolves the local module.
- `pnpm lint` reports no unresolved import.
- No path aliases or resolution exceptions are added for this import.

## Open question

**Question:** Should the module gain a TypeScript path alias?

**Default:** No. There is one native boundary, and its explicit relative import
makes that unusual dependency visible without more configuration.
