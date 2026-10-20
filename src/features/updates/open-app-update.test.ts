import { afterEach, expect, it, jest } from "@jest/globals";
import { Linking } from "react-native";

import webDavUploadEngine from "../../../modules/webdav-upload-engine";
import { openUpdate } from "./open-app-update";

jest.mock("../../../modules/webdav-upload-engine", () => ({
  __esModule: true,
  default: { openPlayStore: jest.fn(async () => ({ ok: true, value: false })) },
}));

afterEach(() => { jest.restoreAllMocks(); });

it("opens the APK through the platform Linking receiver", async () => {
  const browser = jest.spyOn(Linking, "openURL").mockImplementation(function (this: typeof Linking) {
    // The real React Native method uses this._validateURL before opening the URL.
    if (this !== Linking) throw new Error("Linking lost its receiver");
    return Promise.resolve();
  });
  const apkUrl = "https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/android-build-1003/cloud-hoist-0.1.0-build-1003.apk";
  await expect(openUpdate({
    schemaVersion: 1,
    appName: "Cloud Hoist",
    androidPackage: "ninja.domi.cloudhoist",
    version: "0.1.0",
    versionCode: 1003,
    apkUrl,
    sha256: "a".repeat(64),
  })).resolves.toBe("apk");
  expect(browser).toHaveBeenCalledWith(apkUrl);
  expect(webDavUploadEngine.openPlayStore).not.toHaveBeenCalled();
});
