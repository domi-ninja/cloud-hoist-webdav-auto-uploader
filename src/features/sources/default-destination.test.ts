import { describe, expect, it, jest } from "@jest/globals";

import type { EngineValueResult, RemoteFolder } from "../../../modules/webdav-upload-engine";
import {
  defaultRemotePath,
  ensureRemoteDestination,
} from "./default-destination";

describe("default remote destination", () => {
  it("keeps new uploads out of the account root", () => {
    expect(defaultRemotePath()).toEqual(["WebDAV Auto Upload"]);
  });

  it("creates nested destination segments in order", async () => {
    const createFolder = jest.fn(
      async (parent: string[], name: string): Promise<EngineValueResult<RemoteFolder>> => ({
        ok: true,
        value: { name, pathSegments: [...parent, name] },
      }),
    );

    await expect(
      ensureRemoteDestination(["Auto Upload", "Camera"], createFolder),
    ).resolves.toEqual({ ok: true, value: ["Auto Upload", "Camera"] });
    expect(createFolder.mock.calls).toEqual([
      [[], "Auto Upload"],
      [["Auto Upload"], "Camera"],
    ]);
  });

  it("stops when a destination segment cannot be created", async () => {
    const createFolder = jest.fn(
      async (): Promise<EngineValueResult<RemoteFolder>> => ({
        ok: false,
        error: { code: "dav_permission", message: "Folder creation is forbidden." },
      }),
    );

    await expect(
      ensureRemoteDestination(["WebDAV Auto Upload"], createFolder),
    ).resolves.toEqual({
      ok: false,
      error: { code: "dav_permission", message: "Folder creation is forbidden." },
    });
    expect(createFolder).toHaveBeenCalledTimes(1);
  });
});
