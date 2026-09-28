import { describe, expect, it } from "@jest/globals";

import type { EngineSnapshot } from "../../modules/webdav-upload-engine";
import { engineStatus } from "./upload-status";

function snapshot(worker: EngineSnapshot["worker"]): EngineSnapshot {
  return {
    revision: 1,
    account: {
      status: "connected",
      id: "account",
      displayName: "Domi",
      serverUrl: "https://cloud.example.com",
      username: "domi",
      checkedAt: "2026-09-06T12:00:00.000Z",
      davUserId: "domi",
      capabilities: {
        serverVersion: "33.0.0",
        chunkingSupported: true,
        maxChunkSize: null,
      },
    },
    engine: { state: "running" },
    sources: [{
      id: "89348809-84f6-4ea2-8242-3e10c36f4550",
      name: "Camera",
      kind: "media_store",
      localUri: "mediastore://camera",
      remotePath: "/Camera",
      enabled: true,
      collisionPolicy: "replace",
      lastScanAt: null,
    }],
    queue: { queued: 1, uploading: 0, failed: 0, uploaded: 0 },
    recentJobs: [],
    blockers: [],
    worker,
    scheduler: {
      pausedAt: null,
      lastScanRequestedAt: null,
      lastScanCompletedAt: null,
      workerState: "idle",
      workerScope: null,
      constraints: { unmeteredOnly: true, batteryNotLow: true, requiresCharging: false },
    },
  };
}

describe("upload status", () => {
  it("shows the native waiting reason", () => {
    expect(engineStatus(snapshot({ state: "waiting", reason: "Waiting for charging" }), 0))
      .toBe("Waiting for charging");
  });

});
