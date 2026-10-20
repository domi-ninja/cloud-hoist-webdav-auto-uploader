import type { MediaFolder, SourceSummary } from "../../../modules/webdav-upload-engine";
import { selectionForSource, sourceSelectionPath, sourceSelectionUri } from "./source-editor-state";

export function mediaFolderId(folder: Pick<MediaFolder, "volumeName" | "relativePath">) {
  return sourceSelectionUri({ type: "media_folder", ...folder });
}

export function sourceCoversMediaFolder(source: SourceSummary, folder: MediaFolder) {
  if (source.localUri === mediaFolderId(folder)) return true;
  const path = folder.relativePath.replace(/\/$/, "");
  if (source.kind === "saf") {
    const selected = sourceSelectionPath(selectionForSource(source));
    const separator = selected.indexOf(":");
    const volume = selected.slice(0, separator);
    const localPath = selected.slice(separator + 1).replace(/\/$/, "");
    const sameVolume = volume === "primary" ? folder.volumeName === "external_primary" : volume.toLowerCase() === folder.volumeName.toLowerCase();
    return sameVolume && (path === localPath || path.startsWith(`${localPath}/`));
  }
  const leaf = path.split("/").at(-1)?.toLowerCase();
  return (source.localUri === "mediastore://camera" && leaf === "camera") ||
    (source.localUri === "mediastore://screenshots" && leaf === "screenshots");
}

export function mediaFolderSuggestions(folders: MediaFolder[], sources: SourceSummary[], hidden: string[]) {
  const hiddenIds = new Set(hidden);
  return folders
    .filter((folder) => !hiddenIds.has(mediaFolderId(folder)) && !sources.some((source) => sourceCoversMediaFolder(source, folder)))
    .sort((a, b) => b.totalBytes - a.totalBytes || mediaFolderId(a).localeCompare(mediaFolderId(b)))
    .slice(0, 3);
}
