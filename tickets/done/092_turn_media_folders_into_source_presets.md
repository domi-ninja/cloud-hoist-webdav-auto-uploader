# 092 Turn media folders into source presets

Status: done

Parent: 037

Depends on: 090

## Outcome

Camera and Screenshots are shortcuts that prefill the ordinary source editor. The UI does not describe them as default or special folders.

## Work

- Offer Camera, Screenshots, and Choose folder as the ways to start adding a source.
- Open the source editor after any choice.
- Prefill the source name and local location for Camera and Screenshots.
- Skip Android's document-tree permission dialog for Camera and Screenshots. Continue using the media permission flow they require.
- Use the same destination default, collision setting, validation, and Save actions as every other source.
- Let users review and change every applicable value before saving.
- Keep Choose folder backed by Android's document-tree picker and persisted URI permission.
- Remove UI copy that calls Camera or Screenshots default folders or explains their Android implementation.

## Acceptance criteria

- Add source offers Camera, Screenshots, and Choose folder without calling any option default or special.
- Camera and Screenshots open the ordinary source editor with the expected local location and name filled in.
- Those presets do not open the document-tree permission dialog.
- Choose folder still opens the Android folder picker before returning to the same editor.
- No preset saves a source before the user reviews and presses Save.
- Preset-created and folder-created sources have the same editable behavior after saving.

## Verification

- Add focused UI tests for all three entry points and their prefilled editor state.
- Run TypeScript, Expo lint, and Jest.
- Build and install the release APK.
- Create one source through each entry point and confirm only Choose folder opens the document-tree permission dialog.

## Not in this ticket

- Automatic creation of sources during onboarding
- More media presets
- A different editor for MediaStore sources

## $grilling

❓ **Q1** - **Can users change a preset's local location?**: The shared editor could make the local row interactive even for Camera and Screenshots, but changing it would turn the source into a different kind.

➡️ Show the resolved local location as read-only for Camera and Screenshots. Provide a plain Change source action that returns to the three starting choices.

❓ **Q2** - **What if a preset already exists?**: Adding Camera twice could create two jobs that discover the same files.

➡️ Open the existing Camera or Screenshots source in edit mode instead of creating a duplicate preset source.
