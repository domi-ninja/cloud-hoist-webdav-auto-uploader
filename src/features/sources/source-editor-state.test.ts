import { describe, expect, it } from "@jest/globals";

import type { SourceSummary } from "../../../modules/webdav-upload-engine";
import {
  existingPresetSource,
  selectionForSource,
  sourceEditorInitialValue,
  sourceEditorValueKey,
  sourceInputFromEditor,
} from "./source-editor-state";

const source: SourceSummary = {
  id: "source-1",
  name: "Receipts",
  kind: "saf",
  localUri: "content://receipts",
  remotePath: "/Archive/Receipts",
  enabled: false,
  collisionPolicy: "replace",
  lastScanAt: null,
};

describe("source editor state", () => {
  it("hydrates every persisted source field", () => {
    expect(sourceEditorInitialValue(source)).toEqual({
      name: "Receipts",
      selection: { type: "document_tree", treeUri: "content://receipts" },
      remotePathSegments: ["Archive", "Receipts"],
      enabled: false,
      collisionPolicy: "replace",
    });
  });

  it("detects editor changes through a stable value key", () => {
    const initial = sourceEditorInitialValue(source);
    expect(sourceEditorValueKey({ ...initial, name: "Tax receipts" })).not.toBe(
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
      name: "Receipts",
      kind: "saf",
      localUri: "content://receipts",
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
    expect(existingPresetSource([camera], { type: "camera" })?.id).toBe("camera");
    expect(
      existingPresetSource([camera], {
        type: "document_tree",
        treeUri: camera.localUri,
      }),
    ).toBeUndefined();
  });
});
