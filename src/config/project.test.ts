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
      blogUrl: "https://blog.domi.ninja/blog/cloud-hoist/",
      description:
        "Cloud Hoist automatically backs up selected folders from your phone to your own Nextcloud server, with a destination for each folder.",
    });
  });
});
