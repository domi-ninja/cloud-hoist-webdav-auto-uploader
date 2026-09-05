import type {
  SourceSelection,
  SourceSummary,
} from "../../../modules/webdav-upload-engine";

export type SourceEditorValue = {
  name: string;
  selection: SourceSelection | undefined;
  remotePathSegments: string[];
  enabled: boolean;
};

export function selectionForSource(source: SourceSummary): SourceSelection {
  if (source.kind === "saf") {
    return { type: "document_tree", treeUri: source.localUri };
  }
  if (source.localUri === "mediastore://camera") return { type: "camera" };
  return { type: "screenshots" };
}

export function sourceSelectionLabel(selection: SourceSelection | undefined) {
  switch (selection?.type) {
    case "camera":
      return "Camera";
    case "screenshots":
      return "Screenshots";
    case "document_tree":
      return "Android folder";
    default:
      return "Choose a local folder";
  }
}

export function sourceEditorInitialValue(
  source: SourceSummary | undefined,
): SourceEditorValue {
  return {
    name: source?.name ?? "",
    selection: source ? selectionForSource(source) : undefined,
    remotePathSegments: source
      ? source.remotePath.split("/").filter(Boolean)
      : ["WebDAV Auto Upload"],
    enabled: source?.enabled ?? true,
  };
}

export function sourceEditorValueKey(value: SourceEditorValue) {
  return JSON.stringify(value);
}

export function sourceInputFromEditor(
  sourceId: string,
  value: SourceEditorValue & { selection: SourceSelection },
) {
  const { selection } = value;
  return {
    id: sourceId,
    name: value.name,
    kind: selection.type === "document_tree" ? "saf" : "media_store",
    localUri:
      selection.type === "document_tree"
        ? selection.treeUri
        : `mediastore://${selection.type}`,
    remotePath: `/${value.remotePathSegments.join("/")}`,
    enabled: value.enabled,
  } as const;
}
