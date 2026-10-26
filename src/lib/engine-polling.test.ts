import { describe, expect, it } from "@jest/globals";

import {
  ACTIVE_ENGINE_POLL_INTERVAL_MS,
  enginePollInterval,
  uploadDetailPollInterval,
  IDLE_ENGINE_POLL_INTERVAL_MS,
} from "./engine-polling";

describe("enginePollInterval", () => {
  it("does not poll without a connected account", () => {
    expect(enginePollInterval(undefined)).toBe(false);
    expect(
      enginePollInterval({
        account: { status: "not_configured" },
        worker: { state: "idle" },
      }),
    ).toBe(false);
  });

  it("checks occasionally for work started by a headless observer", () => {
    expect(
      enginePollInterval({
        account: { status: "connected" },
        worker: { state: "idle" },
      }),
    ).toBe(IDLE_ENGINE_POLL_INTERVAL_MS);
  });

  it("polls quickly while headless work is active", () => {
    expect(
      enginePollInterval({
        account: { status: "connected" },
        worker: { state: "scanning" },
      }),
    ).toBe(ACTIVE_ENGINE_POLL_INTERVAL_MS);
  });
});

describe("uploadDetailPollInterval", () => {
  it("stops while the detail screen is hidden", () => {
    expect(uploadDetailPollInterval("running", false)).toBe(false);
  });

  it.each(["completed", "blocked", "cancelled"] as const)("stops for a %s upload", (state) => {
    expect(uploadDetailPollInterval(state, true)).toBe(false);
  });

  it.each([undefined, "queued", "running", "retry_wait"] as const)("polls for %s while visible", (state) => {
    expect(uploadDetailPollInterval(state, true)).toBe(ACTIVE_ENGINE_POLL_INTERVAL_MS);
  });
});
