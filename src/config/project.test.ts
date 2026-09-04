import { describe, expect, it } from "@jest/globals";

import { project } from "./project";

describe("project identity", () => {
  it("keeps the app identifiers aligned", () => {
    expect(project).toEqual({
      displayName: "WebDAV Auto Upload",
      androidPackage: "ninja.domi.webdavautoupload",
      supportedServer: "Nextcloud",
    });
  });
});
