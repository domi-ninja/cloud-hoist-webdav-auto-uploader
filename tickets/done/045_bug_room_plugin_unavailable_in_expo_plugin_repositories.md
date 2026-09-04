# 045 Room plugin is unavailable in Expo's plugin repositories

Status: complete

Found while working on: 006

## Bug

The module applied Room's optional Gradle plugin by ID. Expo's generated Android
settings resolve external plugins from the Gradle Plugin Portal, while that
plugin artifact is published through Google's Maven repository.

## Impact

Gradle stops during configuration before compiling the app or Room schema.

## Fix

Keep Room runtime and compiler dependencies, remove the optional Room plugin,
and pass `room.schemaLocation` to KSP directly. This preserves checked-in schema
export without modifying Expo's generated settings file.

## Acceptance criteria

- Gradle configures the Expo app and local module.
- KSP generates the Room implementation.
- Schema version 1 is exported under the module.

## Open question

**Question:** Should we add Google's repository to generated plugin management?

**Default:** No. Avoid a generated-project edit for an optional convenience
plugin when KSP's supported processor argument does the job.
