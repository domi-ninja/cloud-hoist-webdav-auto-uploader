import { describe, expect, it } from "@jest/globals";

import type { SourceSummary } from "../../../modules/webdav-upload-engine";
import {
  existingPresetSource,
  selectionForPickerMode,
  selectionForSource,
  sourceEditorInitialValue,
  sourceEditorValueKey,
  sourceInputFromEditor,
  sourceSelectionLabel,
  sourceSelectionPath,
} from "./source-editor-state";
import { defaultRemotePath } from "./default-destination";

const source: SourceSummary = {
  id: "source-1",
  name: "Receipts",
  kind: "saf",
  localUri:
    "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FReceipts",
  remotePath: "/Archive/Receipts",
  enabled: false,
  collisionPolicy: "replace",
  lastScanAt: null,
};

describe("source editor state", () => {
  it("shows the full selected path while deriving the backup name from its last two folders", () => {
    const selection = {
      type: "document_tree" as const,
      treeUri: "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2F2026%2FReceipts",
    };
    expect(sourceSelectionPath(selection)).toBe("primary:Documents/2026/Receipts");
    expect(sourceSelectionLabel(selection)).toBe("2026/Receipts");
    expect(sourceSelectionPath({ type: "screenshots" })).toBe("Pictures/Screenshots");
  });

  it("saves a changed preset as the selected folder without occupying the screenshots preset", () => {
    const initial = sourceEditorInitialValue(undefined, "screenshots", ["backup"]);
    const selection = selectionForSource(source);
    const saved = sourceInputFromEditor("new-folder", {
      ...initial,
      selection,
      name: sourceSelectionLabel(selection),
      remotePathSegments: defaultRemotePath(selection, ["backup"]),
    });
    expect(saved).toMatchObject({
      kind: "saf",
      localUri: source.localUri,
      name: "Documents/Receipts",
      remotePath: "/backup/Documents/Receipts",
    });
    expect(existingPresetSource([{ ...saved, lastScanAt: null }], { type: "screenshots" })).toBeUndefined();
  });

  it("turns media presets into selected sources", () => {
    expect(selectionForPickerMode("camera")).toEqual({ type: "camera" });
    expect(selectionForPickerMode("screenshots")).toEqual({
      type: "screenshots",
    });
    expect(selectionForPickerMode("folder")).toBeUndefined();
  });

  it("appends a media preset to the configured upload root", () => {
    expect(
      sourceEditorInitialValue(undefined, "screenshots", ["backup"]),
    ).toEqual({
      name: "Pictures/Screenshots",
      selection: { type: "screenshots" },
      remotePathSegments: ["backup", "Pictures", "Screenshots"],
      enabled: true,
      collisionPolicy: "replace",
    });
  });



  it("hydrates every persisted source field", () => {
    expect(sourceEditorInitialValue(source)).toEqual({
      name: "Documents/Receipts",
      selection: { type: "document_tree", treeUri: source.localUri },
      remotePathSegments: ["Archive", "Receipts"],
      enabled: false,
      collisionPolicy: "replace",
    });
  });

  it("detects editor changes through a stable value key", () => {
    const initial = sourceEditorInitialValue(source);
    expect(sourceEditorValueKey({ ...initial, enabled: true })).not.toBe(
      sourceEditorValueKey(initial),
    );
  });

  it("turns editor state into a typed native source update", () => {
    const value = sourceEditorInitialValue(source);
    expect(
      sourceInputFromEditor(source.id, {
        ...value,
        selection: selectionForSource(source),
      }),
    ).toEqual({
      id: "source-1",
      name: "Documents/Receipts",
      kind: "saf",
      localUri: source.localUri,
      remotePath: "/Archive/Receipts",
      enabled: false,
      collisionPolicy: "replace",
    });
  });

  it("finds an existing media preset without deduplicating picked folders", () => {
    const camera = {
      ...source,
      id: "camera",
      kind: "media_store" as const,
      localUri: "mediastore://camera",
    };
    expect(existingPresetSource([camera], { type: "camera" })?.id).toBe(
      "camera",
    );
    expect(
      existingPresetSource([camera], {
        type: "document_tree",
        treeUri: camera.localUri,
      }),
    ).toBeUndefined();
  });

  it("recognizes the default Camera directory selected through the folder browser", () => {
    const camera = {
      ...source,
      localUri: "content://com.android.externalstorage.documents/tree/primary%3ADCIM%2FCamera",
    };
    expect(existingPresetSource([camera], { type: "camera" })).toBe(camera);
    expect(existingPresetSource([camera], { type: "screenshots" })).toBeUndefined();
    expect(existingPresetSource([source], { type: "camera" })).toBeUndefined();
  });
});
