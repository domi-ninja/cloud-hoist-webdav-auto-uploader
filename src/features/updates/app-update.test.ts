import { describe, expect, it, jest } from "@jest/globals";

import app from "../../../app.json";
import { availableUpdate, openAppUpdate, updateConfig } from "./app-update";

const release = {
  schemaVersion: 1 as const,
  appName: "Cloud Hoist",
  androidPackage: "ninja.domi.cloudhoist",
  version: "0.1.0",
  versionCode: 1002,
  apkUrl: "https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/android-build-1002/cloud-hoist-0.1.0-build-1002.apk",
  sha256: "a".repeat(64),
};

describe("app updates", () => {
  it("uses the renamed Android identity and a real boolean store flag", () => {
    expect(updateConfig.androidPackage).toBe(app.expo.android.package);
    expect(updateConfig.appName).toBe(app.expo.name);
    expect(typeof updateConfig.appIsInStore).toBe("boolean");
  });

  it("finds a newer build even when the visible version is unchanged", () => {
    expect(availableUpdate(release, 1001)).toEqual(release);
    expect(availableUpdate(release, 1002)).toBeNull();
    expect(availableUpdate(release, 1003)).toBeNull();
  });

  it("rejects releases for a different Android package", () => {
    expect(() => availableUpdate({ ...release, androidPackage: "ninja.domi.webdavautoupload" }, 1)).toThrow();
  });

  it.each([
    "http://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/v1/app.apk",
    "https://example.com/app.apk",
    "https://github.com/another-owner/another-app/releases/download/v1/app.apk",
    "https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/v1/app.exe",
  ])("rejects an unexpected download URL: %s", (apkUrl) => {
    expect(() => availableUpdate({ ...release, apkUrl }, 1)).toThrow();
  });

  it("rejects invalid release metadata", () => {
    expect(() => availableUpdate({ ...release, versionCode: -1 }, 1)).toThrow();
    expect(() => availableUpdate({ ...release, sha256: "missing" }, 1)).toThrow();
  });

  it("downloads the APK without querying Play Store when the store flag is off", async () => {
    const openPlayStore = jest.fn(async () => true);
    const openUrl = jest.fn(async () => undefined);
    expect(await openAppUpdate(release, { ...updateConfig, appIsInStore: false }, { openPlayStore, openUrl })).toBe("apk");
    expect(openPlayStore).not.toHaveBeenCalled();
    expect(openUrl).toHaveBeenCalledWith(release.apkUrl);
  });

  it("opens the configured Play Store listing when the flag is on and Play Store is available", async () => {
    const openPlayStore = jest.fn(async () => true);
    const openUrl = jest.fn(async () => undefined);
    expect(await openAppUpdate(release, { ...updateConfig, appIsInStore: true }, { openPlayStore, openUrl })).toBe("play-store");
    expect(openPlayStore).toHaveBeenCalledWith("ninja.domi.cloudhoist");
    expect(openUrl).not.toHaveBeenCalled();
  });

  it.each([false, "unavailable"] as const)("falls back to the APK if Play Store cannot open: %s", async (result) => {
    const openPlayStore = async () => {
      if (result === "unavailable") throw new Error("Store disabled");
      return result;
    };
    const openUrl = jest.fn(async () => undefined);
    expect(await openAppUpdate(release, { ...updateConfig, appIsInStore: true }, { openPlayStore, openUrl })).toBe("apk");
    expect(openUrl).toHaveBeenCalledWith(release.apkUrl);
  });

  it("reports a download launch failure instead of claiming the update opened", async () => {
    await expect(openAppUpdate(release, { ...updateConfig, appIsInStore: false }, {
      openPlayStore: async () => false,
      openUrl: async () => { throw new Error("No browser"); },
    })).rejects.toThrow("No browser");
  });
});
