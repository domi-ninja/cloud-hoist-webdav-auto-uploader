import { describe, expect, it } from "@jest/globals";

import {
  accountHealthSchema,
  blockerSchema,
  engineSnapshotSchema,
  engineStateSchema,
  jobStateSchema,
  workerActivitySchema,
} from "./WebDavUploadEngine.types";

const now = "2026-09-04T12:00:00.000Z";

describe("native engine contract", () => {
  it.each([
    { status: "not_configured" },
    {
      status: "connected",
      serverUrl: "https://cloud.example.test",
      username: "domi",
      checkedAt: now,
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
    { state: "scanning", sourceId: "source-1", startedAt: now },
    { state: "uploading", jobId: "job-1", bytesSent: 10, totalBytes: 20 },
    { state: "waiting", reason: "Wi-Fi required" },
  ])("decodes worker activity %#", (value) => {
    expect(workerActivitySchema.parse(value)).toEqual(value);
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
});
