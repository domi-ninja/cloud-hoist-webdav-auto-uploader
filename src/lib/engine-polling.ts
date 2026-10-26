import type { EngineSnapshot, uploadDetailSchema } from "../../modules/webdav-upload-engine";

import type { z } from "zod";

type PollingSnapshot = {
  account: { status: EngineSnapshot["account"]["status"] };
  worker: { state: EngineSnapshot["worker"]["state"] };
};

export const ACTIVE_ENGINE_POLL_INTERVAL_MS = 1_000;
export const IDLE_ENGINE_POLL_INTERVAL_MS = 5_000;

/** Headless Android workers cannot emit through the live Expo module. */
export function enginePollInterval(
  snapshot: PollingSnapshot | undefined,
): number | false {
  if (snapshot?.account.status !== "connected") return false;

  return snapshot.worker.state === "idle"
    ? IDLE_ENGINE_POLL_INTERVAL_MS
    : ACTIVE_ENGINE_POLL_INTERVAL_MS;
}

/** Only active transfers need repeated detail queries while their screen is visible. */
export function uploadDetailPollInterval(
  state: z.infer<typeof uploadDetailSchema>["state"] | undefined,
  focused: boolean,
): number | false {
  if (!focused || state === "completed" || state === "cancelled" || state === "blocked") return false;
  return ACTIVE_ENGINE_POLL_INTERVAL_MS;
}
