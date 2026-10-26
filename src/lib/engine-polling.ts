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

/** Recheck invalidated details until a fresh result confirms whether the upload is terminal. */
export function uploadDetailPollInterval(
  state: z.infer<typeof uploadDetailSchema>["state"] | undefined,
  focused: boolean,
  invalidated = false,
): number | false {
  if (!focused) return false;
  if (!invalidated && (state === "completed" || state === "cancelled" || state === "blocked")) return false;
  return ACTIVE_ENGINE_POLL_INTERVAL_MS;
}
