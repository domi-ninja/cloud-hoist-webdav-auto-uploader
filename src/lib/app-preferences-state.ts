import { remotePathSegmentsSchema } from "../../modules/webdav-upload-engine/src/WebDavUploadEngine.types";

export function formatRemoteRoot(path: string[]) {
  return path.length ? `/${path.join("/")}` : "/";
}

export function parseRemoteRoot(value: string) {
  const trimmed = value.trim();
  if (trimmed === "/") return { ok: true, value: [] as string[] } as const;

  const segments = trimmed.replace(/^\/+|\/+$/g, "").split("/");
  const result = remotePathSegmentsSchema.safeParse(segments);
  if (!trimmed || !result.success) {
    return {
      ok: false,
      error: "Enter a folder path such as /Backups, or / for the account root.",
    } as const;
  }
  return { ok: true, value: result.data } as const;
}
