import { describe, expect, it, jest } from "@jest/globals";

import type {
  EngineValueResult,
  RemoteFolder,
} from "../../../modules/webdav-upload-engine";
import {
  defaultRemotePath,
  ensureRemoteDestination,
} from "./default-destination";

describe("default remote destination", () => {
  it("keeps new uploads out of the account root", () => {
    expect(defaultRemotePath()).toEqual(["Cloud Hoist"]);
  });

  it("appends the source parent and folder to a new destination", () => {
    expect(defaultRemotePath({ type: "camera" })).toEqual([
      "Cloud Hoist",
      "DCIM",
      "Camera",
    ]);
    expect(
      defaultRemotePath({
        type: "document_tree",
        treeUri:
          "content://com.android.externalstorage.documents/tree/primary%3APictures%2FExports",
      }),
    ).toEqual(["Cloud Hoist", "Pictures", "Exports"]);
  });

  it("appends the source path when the configured root is the account root", () => {
    expect(defaultRemotePath({ type: "camera" }, [])).toEqual([
      "DCIM",
      "Camera",
    ]);
  });

  it("uses only the selected folder when it has no parent folder", () => {
    expect(
      defaultRemotePath({
        type: "document_tree",
        treeUri:
          "content://com.android.externalstorage.documents/tree/primary%3ADownload",
      }),
    ).toEqual(["Cloud Hoist", "Download"]);
  });

  it("creates nested destination segments in order", async () => {
    const createFolder = jest.fn(
      async (
        parent: string[],
        name: string,
      ): Promise<EngineValueResult<RemoteFolder>> => ({
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
        error: {
          code: "dav_permission",
          message: "Folder creation is forbidden.",
        },
      }),
    );

    await expect(
      ensureRemoteDestination(["Cloud Hoist"], createFolder),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "dav_permission",
        message: "Folder creation is forbidden.",
      },
    });
    expect(createFolder).toHaveBeenCalledTimes(1);
  });
});
