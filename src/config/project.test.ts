import { describe, expect, it } from "@jest/globals";

import { project } from "./project";

describe("project identity", () => {
  it("keeps the app identifiers aligned", () => {
    expect(project).toEqual({
      displayName: "WebDAV Auto Upload",
      androidPackage: "ninja.domi.webdavautoupload",
      supportedServer: "Nextcloud",
      defaultRemoteFolder: "WebDAV Auto Upload",
      license: "GPL-3.0-or-later",
      compatibilityNotice:
        "WebDAV Auto Upload uploads files to Nextcloud servers. WebDAV Auto Upload is an independent project and is not affiliated with or endorsed by Nextcloud GmbH.",
    });
  });
});
