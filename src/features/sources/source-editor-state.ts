import type {
  SourceSelection,
  SourceSummary,
} from "../../../modules/webdav-upload-engine";

export type SourceEditorValue = {
  name: string;
  selection: SourceSelection | undefined;
  remotePathSegments: string[];
  enabled: boolean;
  collisionPolicy: "replace" | "keep_both";
};

export type SourcePickerMode =
  "all" | "folder" | "media" | "camera" | "screenshots";

export function selectionForPickerMode(
  mode: SourcePickerMode,
): SourceSelection | undefined {
  if (mode === "camera") return { type: "camera" };
  if (mode === "screenshots") return { type: "screenshots" };
  return undefined;
}

export function selectionForSource(source: SourceSummary): SourceSelection {
  if (source.kind === "saf") {
    return { type: "document_tree", treeUri: source.localUri };
  }
  if (source.localUri.startsWith("mediastore://folder/")) {
    const [volumeName, relativePath] = source.localUri.slice("mediastore://folder/".length).split("/").map(decodeURIComponent);
    return { type: "media_folder", volumeName, relativePath };
  }
  if (source.localUri === "mediastore://camera") return { type: "camera" };
  return { type: "screenshots" };
}

export function sourceSelectionLabel(selection: SourceSelection | undefined) {
  const segments = selection ? sourceFolderPathSegments(selection) : [];
  return segments.length ? segments.join("/") : "Choose a local folder";
}

export function sourceSelectionPath(selection: SourceSelection) {
  if (selection.type === "media_folder") return selection.relativePath.replace(/\/$/, "");
  if (selection.type !== "document_tree") {
    return sourceFolderPathSegments(selection).join("/");
  }
  try {
    const documentId = selection.treeUri.split("/tree/")[1]?.split("/document/")[0];
    return documentId ? decodeURIComponent(documentId) : selection.treeUri;
  } catch {
    return selection.treeUri;
  }
}

export function sourceFolderPathSegments(selection: SourceSelection) {
  switch (selection?.type) {
    case "media_folder":
      return selection.relativePath.split("/").filter(Boolean).slice(-2);
    case "camera":
      return ["DCIM", "Camera"];
    case "screenshots":
      return ["Pictures", "Screenshots"];
    case "document_tree":
      try {
        const encodedPath = selection.treeUri
          .split("/tree/")[1]
          ?.split("/document/")[0];
        const storagePath = encodedPath
          ? decodeURIComponent(encodedPath).split(":").slice(1).join(":")
          : "";
        const segments = storagePath.split("/").filter(Boolean).slice(-2);
        return segments.length ? segments : ["Android folder"];
      } catch {
        return ["Android folder"];
      }
  }
}

export function sourceLocalLabel(source: SourceSummary) {
  return sourceSelectionLabel(selectionForSource(source));
}

export function existingPresetSource(
  sources: SourceSummary[],
  selection: SourceSelection,
) {
  if (selection.type === "document_tree") return undefined;
  const localUri = sourceSelectionUri(selection);
  const folderPath = sourceFolderPathSegments(selection).join("/");
  return sources.find(
    (source) =>
      (source.kind === "media_store" && source.localUri === localUri) ||
      (source.kind === "saf" &&
        sourceSelectionPath(selectionForSource(source)) === `primary:${folderPath}`),
  );
}

export function sourceEditorInitialValue(
  source: SourceSummary | undefined,
  pickerMode: SourcePickerMode = "all",
  remoteRootPath: string[] = ["Phone Uploads"],
  initialSelection?: SourceSelection,
): SourceEditorValue {
  const selection = source
    ? selectionForSource(source)
    : initialSelection ?? selectionForPickerMode(pickerMode);
  return {
    name: selection ? sourceSelectionLabel(selection) : "",
    selection,
    remotePathSegments: source
      ? source.remotePath.split("/").filter(Boolean)
      : [
          ...remoteRootPath,
          ...(selection ? sourceFolderPathSegments(selection) : []),
        ],
    enabled: source?.enabled ?? true,
    collisionPolicy: source?.collisionPolicy ?? "replace",
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
    localUri: sourceSelectionUri(selection),
    remotePath: `/${value.remotePathSegments.join("/")}`,
    enabled: value.enabled,
    collisionPolicy: value.collisionPolicy,
  } as const;
}

export function sourceSelectionUri(selection: SourceSelection) {
  if (selection.type === "document_tree") return selection.treeUri;
  if (selection.type === "media_folder") {
    return `mediastore://folder/${encodeURIComponent(selection.volumeName)}/${encodeURIComponent(selection.relativePath)}`;
  }
  return `mediastore://${selection.type}`;
}
