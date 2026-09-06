import { describe, expect, it } from "@jest/globals";

import { formatRemoteRoot } from "./app-preferences-state";

describe("Nextcloud upload root", () => {
  it("displays the account root", () => {
    expect(formatRemoteRoot([])).toBe("/");
  });

  it("displays a selected folder path", () => {
    expect(formatRemoteRoot(["Backups", "Phone"])).toBe("/Backups/Phone");
  });
});
