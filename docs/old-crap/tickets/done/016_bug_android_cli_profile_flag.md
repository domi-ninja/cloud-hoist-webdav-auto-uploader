# 016 Fix Android CLI emulator profile invocation

Status: completed

## Resolution

The setup script uses the CLI's positional `android emulator create medium_phone` syntax. The API 36 AVD was created and setup is idempotent.

Found while working on: 001

## Bug

The current Android CLI documentation describes `android emulator create --profile=medium_phone`, but installed CLI version `1.0.16261425` rejects `--profile`. Its built-in help accepts the profile as a positional argument.

## Impact

A setup script copied from the official overview exits before creating the emulator, so a new developer cannot reproduce the Android environment.

## Fix

- Use `android emulator create medium_phone` for this pinned CLI behavior.
- Make the repository setup script inspect built-in help and fail with the exact supported syntax if the CLI changes again.
- Document the tested Android CLI version and the resulting AVD name.

## Acceptance criteria

- The positional command creates the medium-phone emulator.
- Re-running repository setup detects the existing emulator rather than creating a duplicate.
- The documented command matches `android emulator create --help` from the tested CLI.

## Open question

**Question:** Should setup pin the Android CLI binary itself?

**Default:** Record the tested version and validate its command shape at runtime. Do not redistribute or silently downgrade Google's CLI binary.
