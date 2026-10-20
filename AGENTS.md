# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## UI controls

- Do not make buttons full-phone-width by default.
- Prefer an icon placed next to the item it acts on, or a compact button group whose actions belong together.
- Use a full-width button only when the action genuinely needs that visual priority and cannot be placed more coherently.

## Physical-device validation

- Test affected Android app flows on the connected physical phone before calling app changes complete. Emulator checks alone do not satisfy this requirement.
- Select the phone explicitly. Use signed, in-place updates and test-owned folders and files. Preserve existing accounts, backup settings, queues, history, photos, and server files; do not run data-clearing harnesses against the user's live app.
- Inspect the affected screens on the phone and exercise the changed controls. For upload changes, verify actual uploads against downloaded file hashes. Report the device, build, results, and anything that could not be tested.
