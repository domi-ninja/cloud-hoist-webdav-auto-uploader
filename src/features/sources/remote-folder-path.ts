import { remotePathSegmentSchema } from "../../../modules/webdav-upload-engine/src/WebDavUploadEngine.types";

export function parseRemoteFolderPath(value: string, root: string[]) {
  const segments = value.split("/").filter(Boolean);
  if (segments.some((segment) => !remotePathSegmentSchema.safeParse(segment).success)) {
    return { error: "Enter a folder path without . or .. segments." } as const;
  }
  if (!root.every((segment, index) => segments[index] === segment)) {
    return { error: "Choose a folder inside the backup root." } as const;
  }
  return { segments } as const;
}
