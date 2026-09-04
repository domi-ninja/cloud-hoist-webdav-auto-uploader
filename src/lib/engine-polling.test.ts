import { describe, expect, it } from "@jest/globals";

import {
  ACTIVE_ENGINE_POLL_INTERVAL_MS,
  enginePollInterval,
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
