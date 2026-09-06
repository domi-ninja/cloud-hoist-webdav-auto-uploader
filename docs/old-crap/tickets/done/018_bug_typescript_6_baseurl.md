# 018 Fix strict TypeScript 6 bootstrap errors

Status: completed

## Resolution

The obsolete `baseUrl` setting was removed, CSS imports are declared, and Jest globals are imported explicitly. Typecheck, lint, and tests pass under TypeScript 6.

Found while working on: 001

## Bug

SDK 57's TypeScript 6.0.3 treats the `baseUrl` deprecation as an error. Once removed, strict checking also rejects the side-effect CSS import without a declaration and does not infer Jest's global names in application source.

## Impact

Every clean typecheck fails before it can validate application types.

## Fix

- Remove `baseUrl` from `tsconfig.json`.
- Keep the `@/*` path mapping relative to the configuration file.
- Declare CSS side-effect imports in the NativeWind environment file.
- Import Jest APIs explicitly in tests.
- Do not suppress the warning with `ignoreDeprecations`.

## Acceptance criteria

- `pnpm typecheck` passes on TypeScript 6.0.3.
- `@/config/project` resolves from an application route.
- Global CSS resolves as a declared side-effect module.
- Tests do not depend on ambient Jest globals.
- No deprecation suppression is added.

## Open question

**Question:** Should the project silence TypeScript deprecations until TypeScript 7 forces migration?

**Default:** No. Remove deprecated configuration when a direct supported replacement exists.
