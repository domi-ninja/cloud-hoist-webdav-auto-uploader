import { z } from "zod";

export const accountHealthSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_configured") }),
  z.object({
    status: z.literal("connected"),
    serverUrl: z.string().url(),
    username: z.string().min(1),
    checkedAt: z.string().datetime(),
  }),
  z.object({
    status: z.literal("error"),
    code: z.enum(["unauthorized", "unreachable", "server_error"]),
    message: z.string(),
  }),
]);

export const engineStateSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("running") }),
  z.object({ state: z.literal("paused"), pausedAt: z.string().datetime() }),
  z.object({ state: z.literal("blocked"), blockerCount: z.number().int().nonnegative() }),
]);

export const sourceSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["media_store", "saf"]),
  localUri: z.string().min(1),
  remotePath: z.string().startsWith("/"),
  enabled: z.boolean(),
  lastScanAt: z.string().datetime().nullable(),
});

export const queueCountsSchema = z.object({
  queued: z.number().int().nonnegative(),
  uploading: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  uploaded: z.number().int().nonnegative(),
});

export const jobStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("queued") }),
  z.object({
    status: z.literal("uploading"),
    bytesSent: z.number().int().nonnegative(),
  }),
  z.object({ status: z.literal("uploaded"), uploadedAt: z.string().datetime() }),
  z.object({
    status: z.literal("failed"),
    code: z.string().min(1),
    retryable: z.boolean(),
  }),
]);

export const uploadJobSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  fileName: z.string().min(1),
  byteCount: z.number().int().nonnegative(),
  state: jobStateSchema,
});

export const blockerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("account"),
    code: z.enum(["not_configured", "unauthorized", "unreachable"]),
    message: z.string(),
  }),
  z.object({
    kind: z.literal("permission"),
    sourceId: z.string().min(1),
    permission: z.enum(["media", "folder"]),
  }),
  z.object({
    kind: z.literal("network"),
    retryAt: z.string().datetime().nullable(),
  }),
  z.object({
    kind: z.literal("storage"),
    requiredBytes: z.number().int().nonnegative(),
    availableBytes: z.number().int().nonnegative(),
  }),
]);

export const workerActivitySchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("idle") }),
  z.object({
    state: z.literal("scanning"),
    sourceId: z.string().min(1),
    startedAt: z.string().datetime(),
  }),
  z.object({
    state: z.literal("uploading"),
    jobId: z.string().min(1),
    bytesSent: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
  }),
  z.object({ state: z.literal("waiting"), reason: z.string().min(1) }),
]);

export const activityEntrySchema = z.object({
  id: z.string().min(1),
  type: z.enum(["scan", "upload", "pause", "resume", "source_changed"]),
  message: z.string(),
  occurredAt: z.string().datetime(),
});

export const unresolvedFailureSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  message: z.string(),
  jobId: z.string().min(1).nullable(),
  occurredAt: z.string().datetime(),
  retryable: z.boolean(),
});

export const engineSnapshotSchema = z.object({
  revision: z.number().int().positive(),
  account: accountHealthSchema,
  engine: engineStateSchema,
  sources: z.array(sourceSummarySchema),
  queue: queueCountsSchema,
  recentJobs: z.array(uploadJobSchema),
  blockers: z.array(blockerSchema),
  worker: workerActivitySchema,
});

export const sourceInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  kind: z.enum(["media_store", "saf"]),
  localUri: z.string().min(1),
  remotePath: z.string().startsWith("/"),
  enabled: z.boolean(),
});

export const snapshotInvalidatedSchema = z.object({
  revision: z.number().int().positive(),
});

export type AccountHealth = z.infer<typeof accountHealthSchema>;
export type EngineState = z.infer<typeof engineStateSchema>;
export type SourceSummary = z.infer<typeof sourceSummarySchema>;
export type QueueCounts = z.infer<typeof queueCountsSchema>;
export type UploadJob = z.infer<typeof uploadJobSchema>;
export type Blocker = z.infer<typeof blockerSchema>;
export type WorkerActivity = z.infer<typeof workerActivitySchema>;
export type ActivityEntry = z.infer<typeof activityEntrySchema>;
export type UnresolvedFailure = z.infer<typeof unresolvedFailureSchema>;
export type EngineSnapshot = z.infer<typeof engineSnapshotSchema>;
export type SourceInput = z.infer<typeof sourceInputSchema>;
export type SnapshotInvalidated = z.infer<typeof snapshotInvalidatedSchema>;

export type WebDavUploadEngineModuleEvents = {
  onSnapshotInvalidated: (payload: SnapshotInvalidated) => void;
};

export type EngineError =
  | { code: "source_not_found"; message: string }
  | { code: "invalid_input"; message: string }
  | { code: "native_failure"; message: string };

export type EngineCommandResult = { ok: true } | { ok: false; error: EngineError };
