import { describe, expect, it } from "@jest/globals";

import { formatRemoteRoot, parseRemoteRoot } from "./app-preferences-state";

describe("Nextcloud upload root", () => {
  it("allows the account root", () => {
    expect(parseRemoteRoot("/")).toEqual({ ok: true, value: [] });
    expect(formatRemoteRoot([])).toBe("/");
  });

  it("normalizes a folder path", () => {
    expect(parseRemoteRoot(" /Backups/Phone/ ")).toEqual({
      ok: true,
      value: ["Backups", "Phone"],
    });
  });

  it("rejects an empty or unsafe path", () => {
    expect(parseRemoteRoot("").ok).toBe(false);
    expect(parseRemoteRoot("/../Phone").ok).toBe(false);
  });
});
