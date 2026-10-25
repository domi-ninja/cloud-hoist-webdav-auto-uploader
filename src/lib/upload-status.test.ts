import { describe, expect, it } from "@jest/globals";

import type { EngineSnapshot } from "../../modules/webdav-upload-engine";
import { activeUpload, activeSourceFirst, attentionBlockers, engineStatus, uploadProgress, uploadRemainingTime } from "./upload-status";

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
  it("does not classify a network wait as needing attention", () => {
    const state = snapshot({ state: "waiting", reason: "Waiting for a network connection" });
    state.engine = { state: "blocked", blockerCount: 1 };
    state.blockers = [{ kind: "network", retryAt: null }];
    expect(attentionBlockers(state.blockers)).toEqual([]);
    expect(engineStatus(state, 0)).toBe("Waiting for a network connection");
  });

  it("keeps real blockers actionable", () => {
    const state = snapshot({ state: "idle" });
    state.blockers = [{ kind: "permission", sourceId: "camera", permission: "media" }];
    expect(attentionBlockers(state.blockers)).toHaveLength(1);
    expect(engineStatus(state, 0)).toBe("Restore photo access");
  });
  it("shows the native waiting reason", () => {
    expect(engineStatus(snapshot({ state: "waiting", reason: "Waiting for charging" }), 0))
      .toBe("Waiting for charging");
  });

  it.each([
    { state: "idle" },
    { state: "waiting", reason: "Waiting for charging" },
    { state: "stopped", reason: "Uploads stopped" },
    { state: "scanning", scope: "all", startedAt: "2026-09-06T12:00:00.000Z" },
  ] satisfies EngineSnapshot["worker"][])("keeps the user's pause explicit while the worker is $state", (worker) => {
    const state = snapshot(worker);
    state.engine = { state: "paused", pausedAt: "2026-09-06T12:00:00.000Z" };
    expect(engineStatus(state, 0)).toBe("Uploads paused by you");
  });

  it("describes cancellation honestly while a paused upload is stopping", () => {
    const state = snapshot({ state: "uploading", jobId: "job", bytesSent: 0, totalBytes: 20 });
    state.engine = { state: "paused", pausedAt: "2026-09-06T12:00:00.000Z" };
    expect(engineStatus(state, 0)).toBe("Uploads paused by you · stopping the current upload");
  });

  it("does not claim all files are uploaded while a disabled folder has pending files", () => {
    const state = snapshot({ state: "waiting", reason: "Camera backup is disabled" });
    state.queue = { queued: 1734, uploading: 0, failed: 0, uploaded: 2679 };
    expect(engineStatus(state, 0)).toBe("Camera backup is disabled");
    expect(uploadProgress(state)).toEqual({ uploaded: 2679, total: 4413, fraction: 2679 / 4413 });
  });

  it("counts uploading and failed files in the total without counting them as completed", () => {
    const state = snapshot({ state: "uploading", jobId: "job", bytesSent: 0, totalBytes: 20 });
    state.queue = { queued: 7, uploading: 1, failed: 2, uploaded: 10 };
    expect(uploadProgress(state)).toEqual({ uploaded: 10, total: 20, fraction: 0.5 });
    expect(engineStatus(state, 0)).toBe("Uploading");
  });

  it("handles an empty queue without invalid progress", () => {
    const state = snapshot({ state: "idle" });
    state.queue = { queued: 0, uploading: 0, failed: 0, uploaded: 0 };
    expect(uploadProgress(state)).toEqual({ uploaded: 0, total: 0, fraction: 0 });
  });

  it("reports completion only when no files remain", () => {
    const state = snapshot({ state: "idle" });
    state.queue = { queued: 0, uploading: 0, failed: 0, uploaded: 10 };
    expect(engineStatus(state, 0)).toBe("All files uploaded");
    expect(uploadProgress(state).fraction).toBe(1);
  });

  it("reports a stopped worker separately from a user pause", () => {
    expect(engineStatus(snapshot({ state: "stopped", reason: "Uploads stopped" }), 0)).toBe("Uploads stopped");
  });

});

describe("upload remaining time", () => {
  const uploading = () => snapshot({ state: "uploading", jobId: "job", bytesSent: 0, totalBytes: 100 });
  it("waits for a throughput sample and formats estimates", () => {
    const state = uploading();
    expect(uploadRemainingTime(state)).toBe("Estimating…");
    state.queue.estimatedRemainingSeconds = 45;
    expect(uploadRemainingTime(state)).toBe("<1 min left");
    state.queue.estimatedRemainingSeconds = 140;
    expect(uploadRemainingTime(state)).toBe("~3 min left");
    state.queue.estimatedRemainingSeconds = 4000;
    expect(uploadRemainingTime(state)).toBe("~1 hr 7 min left");
  });
  it("hides stale estimates during pauses, waits, and failures", () => {
    const state = uploading();
    state.queue.estimatedRemainingSeconds = 140;
    state.engine = { state: "paused", pausedAt: "2026-10-20T12:00:00Z" };
    expect(uploadRemainingTime(state)).toBeNull();
    state.engine = { state: "running" };
    state.queue.failed = 1;
    expect(uploadRemainingTime(state)).toBeNull();
    state.queue.failed = 0;
    state.sources[0].enabled = false;
    state.sources[0].queue = { pending: 1, failed: 0 };
    expect(uploadRemainingTime(state)).toBe("~3 min left");
    state.sources[0].enabled = true;
    state.worker = { state: "waiting", reason: "Waiting for Wi-Fi" };
    expect(uploadRemainingTime(state)).toBeNull();
  });
});


it("promotes only the active worker source and preserves every other folder's order", () => {
  const state = snapshot({ state: "uploading", jobId: "active", bytesSent: 0, totalBytes: 10 });
  const base = state.sources[0];
  state.sources = ["first", "second", "third"].map((id) => ({ ...base, id }));
  state.recentJobs = [{ id: "active", sourceId: "third", fileName: "long photo name.jpg", byteCount: 10, state: { status: "queued" } }];
  expect(activeUpload(state)?.fileName).toBe("long photo name.jpg");
  expect(activeSourceFirst(state).map((source) => source.id)).toEqual(["third", "first", "second"]);
  expect(state.sources.map((source) => source.id)).toEqual(["first", "second", "third"]);
  state.engine = { state: "blocked", blockerCount: 1 };
  expect(activeUpload(state)?.fileName).toBe("long photo name.jpg");
  state.sources[2].enabled = false;
  expect(activeUpload(state)).toBeUndefined();
  state.sources[2].enabled = true;
  state.engine = { state: "paused", pausedAt: "2026-10-25T12:00:00.000Z" };
  expect(activeUpload(state)).toBeUndefined();
  expect(activeSourceFirst(state)).toBe(state.sources);
  state.engine = { state: "running" };
  state.worker = { state: "idle" };
  expect(activeUpload(state)).toBeUndefined();
});
