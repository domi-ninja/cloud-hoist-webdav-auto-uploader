# Backup UI decisions

User requirements recorded verbatim in `backup-fixes-raw-input.txt`.

- Presets are initial selections, not restrictions. The selected name, path and thumbnails remain visible, with no collapse control.
- Hide destination and file-handling options until a local folder is selected.
- Hide a default preset shortcut when that folder is already configured, including a default folder chosen through Android's folder browser. Changing it to another folder makes the preset available again.
- The editor has primary-colored confirmation controls at the top right and at the bottom right. It has no enable toggle, deletion action, maintenance section or debugging controls.
- Each backup card owns its enable toggle and a hamburger menu containing Edit and Remove. Removal requires confirmation and does not delete local or remote files.
- Show status and queue counts together on one line, wrapping only when needed for text scaling.
- Normal network/charging waits and automatic retry backoff are status, not "Needs attention". Do not infer a network restriction from a retrying job.
- Keep debugging and history-reset tools out of the user-facing app.

## 2026-09-29 verification

The Samsung was on validated unmetered Wi-Fi, connected to power and fully charged. Before the update it already showed all 15 files uploaded. The misleading network message came from mapping every retry-wait job to a network blocker, even server errors and ordinary retry backoff. The snapshot now reports actual constraint waits separately from automatic retries; neither creates an actionable blocker.

Regression tests cover retry backoff on an allowed network, constraint waits clearing, actionable blocker filtering, and recognizing an already configured default directory. The main live stress UI test also checks preset changes and the revised menu/editor controls.

The app was updated in place on Samsung without clearing its account, backup folders or history. Both folders and all 15 uploaded records remained. The Camera preset disappeared, the menu opened Edit/Remove, both primary Save controls were enabled and visible without scrolling, and the removal confirmation was cancelled without deleting anything.
