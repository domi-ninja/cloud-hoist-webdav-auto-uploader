import { describe, expect, it } from "@jest/globals";

import type { SourceSummary } from "../../../modules/webdav-upload-engine";
import {
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
  lastScanAt: null,
};

describe("source editor state", () => {
  it("hydrates every persisted source field", () => {
    expect(sourceEditorInitialValue(source)).toEqual({
      name: "Receipts",
      selection: { type: "document_tree", treeUri: "content://receipts" },
      remotePathSegments: ["Archive", "Receipts"],
      enabled: false,
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
    });
  });
});
