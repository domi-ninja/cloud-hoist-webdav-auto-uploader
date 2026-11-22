import type { MediaFolder, SourceSummary } from "../../../modules/webdav-upload-engine";
import { sourceSelectionUri } from "./source-editor-state";

export function mediaFolderId(folder: Pick<MediaFolder, "volumeName" | "relativePath">) {
  return sourceSelectionUri({ type: "media_folder", ...folder });
}

const storageTreePrefix = "content://com.android.externalstorage.documents/tree/";

export function storageTreeLocation(uri: string) {
  if (!uri.startsWith(storageTreePrefix)) return undefined;
  try {
    const id = decodeURIComponent(uri.slice(storageTreePrefix.length).split("/")[0]);
    const separator = id.indexOf(":");
    if (separator <= 0) return undefined;
    const volume = id.slice(0, separator).toLowerCase();
    return {
      volumeName: volume === "primary" ? "external_primary" : volume,
      path: id.slice(separator + 1).replace(/\/$/, ""),
    };
  } catch {
    return undefined;
  }
}

export function treeCoversFolder(tree: NonNullable<ReturnType<typeof storageTreeLocation>>, folder: MediaFolder) {
  const path = folder.relativePath.replace(/\/$/, "");
  return tree.volumeName === folder.volumeName.toLowerCase() &&
    (!tree.path || path === tree.path || path.startsWith(`${tree.path}/`));
}

export function hiddenMediaFolderLabel(id: string) {
  const tree = storageTreeLocation(id);
  if (tree) return tree.volumeName === "external_primary" ? tree.path || "Internal storage" :
    tree.path ? `${tree.path} (${tree.volumeName})` : tree.volumeName;
  try {
    const [volume, path] = id.replace(/^mediastore:\/\/folder\//, "").split("/").map(decodeURIComponent);
    if (!path) return id;
    const label = path.replace(/\/$/, "");
    return volume === "external_primary" ? label : `${label} (${volume})`;
  } catch {
    return id;
  }
}

export function sourceCoversMediaFolder(source: SourceSummary, folder: MediaFolder) {
  if (source.localUri === mediaFolderId(folder)) return true;
  const path = folder.relativePath.replace(/\/$/, "");
  if (source.kind === "saf") {
    const tree = storageTreeLocation(source.localUri);
    return tree !== undefined && treeCoversFolder(tree, folder);
  }
  const leaf = path.split("/").at(-1)?.toLowerCase();
  return (source.localUri === "mediastore://camera" && leaf === "camera") ||
    (source.localUri === "mediastore://screenshots" && leaf === "screenshots");
}

export function mediaFolderSuggestions(folders: MediaFolder[], sources: SourceSummary[], hidden: string[]) {
  const hiddenIds = new Set(hidden);
  const trees = hidden.map(storageTreeLocation).filter((tree) => tree !== undefined);
  return folders
    .filter((folder) => !hiddenIds.has(mediaFolderId(folder)) && !trees.some((tree) => treeCoversFolder(tree, folder)) && !sources.some((source) => sourceCoversMediaFolder(source, folder)))
    .sort((a, b) => b.totalBytes - a.totalBytes || mediaFolderId(a).localeCompare(mediaFolderId(b)))
    .slice(0, 2);
}
