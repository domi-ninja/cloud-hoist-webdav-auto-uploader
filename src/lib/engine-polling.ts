import type { EngineSnapshot } from "../../modules/webdav-upload-engine";

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
