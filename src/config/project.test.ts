import { describe, expect, it } from "@jest/globals";

import { project } from "./project";

describe("project identity", () => {
  it("keeps the app identifiers aligned", () => {
    expect(project).toEqual({
      displayName: "Cloud Hoist",
      androidPackage: "ninja.domi.cloudhoist",
      supportedServer: "Nextcloud",
      defaultRemoteFolder: "Phone Uploads",
      license: "GPL-3.0-or-later",
      compatibilityNotice:
        "Cloud Hoist uploads files to Nextcloud servers. Cloud Hoist is an independent project and is not affiliated with or endorsed by Nextcloud GmbH.",
    });
  });
});
