import { expect, it } from "@jest/globals";
import type { MediaFolder, SourceSummary } from "../../../modules/webdav-upload-engine";
import { hiddenMediaFolderLabel, mediaFolderId, mediaFolderSuggestions } from "./media-folder-suggestions";
import { selectionForSource, sourceInputFromEditor } from "./source-editor-state";
const folder = (path: string, bytes: number, volume = "external_primary"): MediaFolder => ({
  relativePath: `${path}/`, volumeName: volume, totalBytes: bytes, fileCount: 3,
});
const source = (localUri: string, kind: SourceSummary["kind"] = "media_store"): SourceSummary => ({
  id: "configured", name: "Configured", localUri, kind, remotePath: "/Cloud Hoist", enabled: true,
  collisionPolicy: "replace", lastScanAt: null,
});
it("chooses the largest two from every discovered folder and backfills hidden suggestions", () => {
  const folders = [folder("Pictures/Small", 1), folder("Pictures/Random", 40), folder("Telegram/Images", 30), folder("WhatsApp/Media", 20), folder("Threema/Media", 10)];
  expect(mediaFolderSuggestions(folders, [], []).map((item) => item.totalBytes)).toEqual([40, 30]);
  expect(mediaFolderSuggestions(folders, [], [mediaFolderId(folders[1])]).map((item) => item.totalBytes)).toEqual([30, 20]);
  folders[0].totalBytes = 100;
  expect(mediaFolderSuggestions(folders, [], [])[0]).toBe(folders[0]);
});
it("excludes configured folders, including disabled backups and children of SAF sources", () => {
  const folders = [folder("Pictures/Direct", 100), folder("Android/media/chat.app/Media", 90), folder("DCIM/Camera", 80), folder("Pictures/Direct", 70, "1234-5678")];
  const direct = { ...source(mediaFolderId(folders[0])), enabled: false };
  const parent = source("content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fchat.app", "saf");
  const camera = source("mediastore://camera");
  expect(mediaFolderSuggestions(folders, [direct, parent, camera], [])).toEqual([folders[3]]);
});
it("round-trips arbitrary nested folders without turning them into Screenshots", () => {
  const candidate = folder("Android/media/chat.app/My Images", 100);
  const selection = selectionForSource(source(mediaFolderId(candidate)));
  expect(selection).toEqual({ type: "media_folder", volumeName: "external_primary", relativePath: candidate.relativePath });
  const input = sourceInputFromEditor("configured", { selection, name: "My Images", remotePathSegments: ["Cloud Hoist"], enabled: true, collisionPolicy: "replace" });
  expect(input.localUri).toBe(mediaFolderId(candidate));
});

it("labels saved hidden folders even when they are no longer discovered", () => {
  expect(hiddenMediaFolderLabel(mediaFolderId(folder("Pictures/Holidays #1 % 家", 1)))).toBe("Pictures/Holidays #1 % 家");
  expect(hiddenMediaFolderLabel(mediaFolderId(folder("Pictures/Holidays", 1, "1234-5678")))).toBe("Pictures/Holidays (1234-5678)");
  expect(hiddenMediaFolderLabel("mediastore://folder/broken/%ZZ")).toBe("mediastore://folder/broken/%ZZ");
});
