import { describe, expect, it } from "@jest/globals";

import { nextcloudInstanceIconUrl } from "./instance-icon";

describe("nextcloudInstanceIconUrl", () => {
  it("loads the themed touch icon from the instance root", () => {
    expect(nextcloudInstanceIconUrl("https://cloud.example.com")).toBe(
      "https://cloud.example.com/index.php/apps/theming/icon",
    );
  });

  it("preserves a Nextcloud subpath", () => {
    expect(nextcloudInstanceIconUrl("https://example.com/nextcloud/")).toBe(
      "https://example.com/nextcloud/index.php/apps/theming/icon",
    );
  });
});
