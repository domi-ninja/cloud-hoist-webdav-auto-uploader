import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { project } from "@/config/project";
import { checkAppUpdates } from "./app-updates";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function reply(body: unknown, status = 200) {
  return jest.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

function catalogue(suggestedVersionCode = 20260009) {
  return {
    packageName: project.androidPackage,
    suggestedVersionCode,
    packages: [
      { versionName: "2026-9", versionCode: 20260009 },
      { versionName: "2026-8", versionCode: 20260008 },
    ],
  };
}

describe("F-Droid update checks", () => {
  it("reports matching and newer installed versions as up to date", async () => {
    reply(catalogue());
    await expect(checkAppUpdates(20260009, "fdroid")).resolves.toEqual({ status: "up-to-date" });
    await expect(checkAppUpdates(20260010, "fdroid")).resolves.toEqual({ status: "up-to-date" });
  });

  it("offers a published update based on versionCode", async () => {
    reply(catalogue());
    await expect(checkAppUpdates(20260008, "fdroid")).resolves.toEqual({ status: "available", version: "2026-9", url: `https://f-droid.org/packages/${project.androidPackage}/` });
  });

  it("does not advertise an unbuilt suggested version", async () => {
    reply(catalogue(20260010));
    await expect(checkAppUpdates(20260009, "fdroid")).resolves.toEqual({ status: "up-to-date" });
  });

  it("uses the published suggested version instead of a newer prerelease", async () => {
    reply(catalogue(20260008));
    await expect(checkAppUpdates(20260008, "fdroid")).resolves.toEqual({ status: "up-to-date" });
  });

  it("reports a missing listing as a failed check", async () => {
    reply({}, 404);
    await expect(checkAppUpdates(20260009, "fdroid")).rejects.toThrow("Update check failed: Cloud Hoist is not listed on F-Droid yet.");
  });

  it("reports HTTP failures", async () => {
    reply({}, 503);
    await expect(checkAppUpdates(20260009, "fdroid")).rejects.toThrow("Update check failed: F-Droid returned HTTP 503.");
  });

  it.each([
    { ...catalogue(), packageName: "another.app" },
    { ...catalogue(), packages: [] },
    { ...catalogue(), packages: [{ versionName: "2026-9", versionCode: "20260009" }] },
  ])("rejects invalid catalogues rather than claiming up to date", async (body) => {
    reply(body);
    await expect(checkAppUpdates(20260009, "fdroid")).rejects.toThrow("Update check failed: F-Droid returned invalid version information.");
  });

  it("reports connection failures", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("Network request failed"));
    await expect(checkAppUpdates(20260009, "fdroid")).rejects.toThrow("Update check failed:");
  });

  it("reports unreadable responses", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("not json"));
    await expect(checkAppUpdates(20260009, "fdroid")).rejects.toThrow("Update check failed:");
  });

  it("aborts stalled checks and reports the timeout", async () => {
    jest.useFakeTimers();
    jest.spyOn(global, "fetch").mockImplementation((_input, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const check = expect(checkAppUpdates(20260009, "fdroid")).rejects.toThrow("Update check failed: the request timed out.");
    await jest.advanceTimersByTimeAsync(15_000);
    await check;
    expect(jest.getTimerCount()).toBe(0);
  });
});

function release(version: string, tag = `beta-${version}`) {
  return {
    tag_name: tag, draft: false, prerelease: true,
    assets: [{ name: `cloud-hoist-${version}.apk`, state: "uploaded", size: 123,
      browser_download_url: `https://github.com/domi-ninja/cloud-hoist-webdav-auto-uploader/releases/download/${tag}/cloud-hoist-${version}.apk` }],
  };
}

describe("GitHub beta update checks", () => {
  it("uses GitHub by default and offers prerelease APKs", async () => {
    const fetch = reply([release("2026-10")]);
    await expect(checkAppUpdates(20260009)).resolves.toEqual({ status: "available", version: "2026-10",
      url: release("2026-10").assets[0].browser_download_url });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("api.github.com/repos/domi-ninja/"), expect.anything());
  });

  it("compares numeric year-minor versions regardless of release ordering", async () => {
    reply([release("2026-9"), release("2026-11"), release("2026-10")]);
    await expect(checkAppUpdates(20260010)).resolves.toMatchObject({ version: "2026-11" });
  });

  it("does not offer drafts, missing APKs, partial uploads, or F-Droid reference APKs", async () => {
    reply([release("2026-9", "v2026-9"), { ...release("2026-10"), draft: true },
      { ...release("2026-11"), assets: [] },
      { ...release("2026-12"), assets: [{ ...release("2026-12").assets[0], state: "new" }] },
      release("2026-13", "fdroid-reference-2026-13")]);
    await expect(checkAppUpdates(20260009)).resolves.toEqual({ status: "up-to-date" });
  });

  it("reports the installed beta as up to date even before it is published", async () => {
    reply([release("2026-9")]);
    await expect(checkAppUpdates(20260010)).resolves.toEqual({ status: "up-to-date" });
  });

  it("rejects unexpected download hosts and empty APKs", async () => {
    reply([{ ...release("2026-10"), assets: [{ ...release("2026-10").assets[0], browser_download_url: "https://example.com/app.apk" }] },
      { ...release("2026-11"), assets: [{ ...release("2026-11").assets[0], size: 0 }] }]);
    await expect(checkAppUpdates(20260009)).rejects.toThrow("GitHub has no published beta APKs");
  });

  it.each([[], {}, [{ tag_name: "beta-2026-10" }]])("does not claim success for empty or malformed releases", async (body) => {
    reply(body);
    await expect(checkAppUpdates(20260009)).rejects.toThrow("Update check failed:");
  });

  it("reports rate limits and network failures explicitly", async () => {
    reply({}, 403);
    await expect(checkAppUpdates(20260009)).rejects.toThrow("GitHub returned HTTP 403");
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("offline"));
    await expect(checkAppUpdates(20260009)).rejects.toThrow("GitHub could not be reached");
  });
});
