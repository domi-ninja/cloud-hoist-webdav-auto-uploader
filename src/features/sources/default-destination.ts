import { project } from "@/config/project";
import { sourceFolderPathSegments } from "./source-editor-state";
import type {
  EngineValueResult,
  RemoteFolder,
  SourceSelection,
} from "../../../modules/webdav-upload-engine";

type CreateRemoteFolder = (
  parentPathSegments: string[],
  name: string,
) => Promise<EngineValueResult<RemoteFolder>>;

export function defaultRemotePath(
  selection?: SourceSelection,
  remoteRootPath: string[] = [project.defaultRemoteFolder],
) {
  return [
    ...remoteRootPath,
    ...(selection ? sourceFolderPathSegments(selection) : []),
  ];
}

export async function ensureRemoteDestination(
  pathSegments: string[],
  createRemoteFolder: CreateRemoteFolder,
): Promise<EngineValueResult<string[]>> {
  let parentPathSegments: string[] = [];

  for (const name of pathSegments) {
    const result = await createRemoteFolder(parentPathSegments, name);
    if (!result.ok) return result;
    parentPathSegments = result.value.pathSegments;
  }

  return { ok: true, value: parentPathSegments };
}
