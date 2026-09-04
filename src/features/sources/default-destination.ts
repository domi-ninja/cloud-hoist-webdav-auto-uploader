import { project } from "@/config/project";
import type {
  EngineValueResult,
  RemoteFolder,
} from "../../../modules/webdav-upload-engine";

type CreateRemoteFolder = (
  parentPathSegments: string[],
  name: string,
) => Promise<EngineValueResult<RemoteFolder>>;

export function defaultRemotePath() {
  return [project.defaultRemoteFolder];
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
