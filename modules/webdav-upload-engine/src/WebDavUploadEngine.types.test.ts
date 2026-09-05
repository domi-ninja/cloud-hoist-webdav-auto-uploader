import { describe, expect, it } from "@jest/globals";

import {
  accountHealthSchema,
  accountSummarySchema,
  activityPageSchema,
  blockerSchema,
  engineSnapshotSchema,
  engineStateSchema,
  jobStateSchema,
  loginFlowPollSchema,
  loginFlowStartSchema,
  notificationPermissionStateSchema,
  remoteFolderSchema,
  remotePathSegmentsSchema,
  schedulerStatusSchema,
  workerActivitySchema,
  sourceCommitSchema,
  sourceSummarySchema,
} from "./WebDavUploadEngine.types";

const now = "2026-09-04T12:00:00.000Z";
const account = {
  id: "3fd9c8c2-7d27-4c63-a672-4fb8793582fa",
  serverUrl: "https://cloud.example.test",
  username: "domi@example.test",
  davUserId: "domi",
  displayName: "Domi",
  checkedAt: now,
  capabilities: {
    serverVersion: "34.0.0",
    chunkingSupported: true,
    maxChunkSize: 10485760,
  },
};

describe("native engine contract", () => {
  it.each([
    { status: "not_configured" },
    {
      status: "connected",
      ...account,
    },
    { status: "error", code: "unreachable", message: "Cannot reach server." },
  ])("decodes account health %#", (value) => {
    expect(accountHealthSchema.parse(value)).toEqual(value);
  });

  it.each([
    { state: "running" },
    { state: "paused", pausedAt: now },
    { state: "blocked", blockerCount: 2 },
  ])("decodes engine state %#", (value) => {
    expect(engineStateSchema.parse(value)).toEqual(value);
  });

  it.each([
    { kind: "account", code: "not_configured", message: "Connect an account." },
    { kind: "permission", sourceId: "source-1", permission: "media" },
    { kind: "network", retryAt: now },
    { kind: "storage", requiredBytes: 20, availableBytes: 10 },
  ])("decodes blocker %#", (value) => {
    expect(blockerSchema.parse(value)).toEqual(value);
  });

  it.each([
    { status: "queued" },
    { status: "uploading", bytesSent: 10 },
    { status: "uploaded", uploadedAt: now },
    { status: "failed", code: "timeout", retryable: true },
  ])("decodes job state %#", (value) => {
    expect(jobStateSchema.parse(value)).toEqual(value);
  });

  it.each([
    { state: "idle" },
    { state: "scanning", scope: "media", startedAt: now },
    { state: "uploading", jobId: "job-1", bytesSent: 10, totalBytes: 20 },
    { state: "waiting", reason: "Wi-Fi required" },
  ])("decodes worker activity %#", (value) => {
    expect(workerActivitySchema.parse(value)).toEqual(value);
  });

  it("decodes honest scheduler state without a predicted next run", () => {
    const status = {
      pausedAt: null,
      lastScanRequestedAt: now,
      lastScanCompletedAt: now,
      workerState: "idle",
      workerScope: null,
      constraints: {
        unmeteredOnly: true,
        batteryNotLow: true,
        requiresCharging: false,
      },
    };

    expect(schedulerStatusSchema.parse(status)).toEqual(status);
    expect(status).not.toHaveProperty("nextRunAt");
  });

  it("rejects a snapshot with a missing required native field", () => {
    expect(() =>
      engineSnapshotSchema.parse({
        revision: 1,
        account: { status: "not_configured" },
        engine: { state: "running" },
        sources: [],
        queue: { queued: 0, uploading: 0, failed: 0, uploaded: 0 },
        recentJobs: [],
        blockers: [],
      }),
    ).toThrow();
  });

  it("rejects unknown discriminator values", () => {
    expect(() => blockerSchema.parse({ kind: "mystery" })).toThrow();
  });

  it("decodes account and browser-login results without secret fields", () => {
    expect(accountSummarySchema.parse(account)).toEqual(account);
    expect(
      loginFlowStartSchema.parse({
        attemptId: "71e3a374-8cb9-4cae-bdb4-508e8ca473b9",
        loginUrl: "https://cloud.example.test/login/v2/flow/opaque",
        expiresAt: now,
      }),
    ).not.toHaveProperty("appPassword");
    expect(loginFlowPollSchema.parse({ status: "pending" })).toEqual({
      status: "pending",
    });
    expect(
      loginFlowPollSchema.parse({ status: "connected", account }),
    ).not.toHaveProperty("account.appPassword");
  });

  it("rejects insecure account and browser-login URLs", () => {
    expect(() =>
      accountSummarySchema.parse({ ...account, serverUrl: "http://cloud.test" }),
    ).toThrow();
    expect(() =>
      loginFlowStartSchema.parse({
        attemptId: "71e3a374-8cb9-4cae-bdb4-508e8ca473b9",
        loginUrl: "http://cloud.test/login",
        expiresAt: now,
      }),
    ).toThrow();
  });

  it("decodes remote folders as path segments", () => {
    const folder = {
      name: "Photos #1",
      pathSegments: ["Auto Upload", "Photos #1"],
    };
    expect(remoteFolderSchema.parse(folder)).toEqual(folder);
    expect(() => remotePathSegmentsSchema.parse(["Auto Upload/Photos"])).toThrow();
    expect(() => remotePathSegmentsSchema.parse([".."])).toThrow();
  });

  it("decodes notification permission without platform-specific details", () => {
    expect(
      notificationPermissionStateSchema.parse({ granted: false, canAskAgain: true }),
    ).toEqual({ granted: false, canAskAgain: true });
  });

  it("decodes a bounded activity page", () => {
    const page = {
      items: [
        {
          id: "attempt-1",
          type: "upload",
          message: "Upload completed.",
          occurredAt: now,
        },
      ],
      nextOffset: 20,
    };

    expect(activityPageSchema.parse(page)).toEqual(page);
    expect(() => activityPageSchema.parse({ ...page, nextOffset: -1 })).toThrow();
  });

  it("requires an explicit source collision policy", () => {
    const source = {
      id: "source-1",
      name: "Camera",
      kind: "media_store",
      localUri: "mediastore://camera",
      remotePath: "/Photos",
      enabled: true,
      collisionPolicy: "replace",
      lastScanAt: null,
    };
    expect(sourceSummarySchema.parse(source)).toEqual(source);
    expect(
      sourceCommitSchema.parse({
        name: "Camera",
        selection: { type: "camera" },
        remotePathSegments: ["Photos"],
        collisionPolicy: "keep_both",
      }),
    ).toHaveProperty("collisionPolicy", "keep_both");
  });
});
