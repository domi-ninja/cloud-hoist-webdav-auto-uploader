import { z } from "zod";

export const accountCapabilitiesSchema = z.object({
  serverVersion: z.string().min(1),
  chunkingSupported: z.boolean(),
  maxChunkSize: z.number().int().positive().nullable(),
});

export const accountSummarySchema = z.object({
  id: z.string().uuid(),
  serverUrl: z.string().url().startsWith("https://"),
  username: z.string().min(1),
  davUserId: z.string().min(1),
  displayName: z.string().min(1),
  checkedAt: z.string().datetime(),
  capabilities: accountCapabilitiesSchema,
});

export const accountHealthSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_configured") }),
  accountSummarySchema.extend({ status: z.literal("connected") }),
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

export const manualAccountInputSchema = z.object({
  serverUrl: z.string().trim().min(1),
  username: z.string().trim().min(1),
  appPassword: z.string().min(1),
});

export const loginFlowStartSchema = z.object({
  attemptId: z.string().uuid(),
  loginUrl: z.string().url().startsWith("https://"),
  expiresAt: z.string().datetime(),
});

export const loginFlowPollSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({
    status: z.literal("connected"),
    account: accountSummarySchema,
  }),
]);

export const remotePathSegmentSchema = z
  .string()
  .min(1)
  .refine((segment) => segment !== "." && segment !== "..")
  .refine((segment) => !segment.includes("/") && !segment.includes("\0"));

export const remotePathSegmentsSchema = z.array(remotePathSegmentSchema);

export const remoteFolderSchema = z.object({
  name: remotePathSegmentSchema,
  pathSegments: remotePathSegmentsSchema,
});

export type AccountCapabilities = z.infer<typeof accountCapabilitiesSchema>;
export type AccountSummary = z.infer<typeof accountSummarySchema>;
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
export type ManualAccountInput = z.infer<typeof manualAccountInputSchema>;
export type LoginFlowStart = z.infer<typeof loginFlowStartSchema>;
export type LoginFlowPoll = z.infer<typeof loginFlowPollSchema>;
export type RemoteFolder = z.infer<typeof remoteFolderSchema>;

export type WebDavUploadEngineModuleEvents = {
  onSnapshotInvalidated: (payload: SnapshotInvalidated) => void;
};

export type EngineError =
  | { code: "source_not_found"; message: string }
  | { code: "invalid_input"; message: string }
  | { code: "invalid_server_url"; message: string }
  | { code: "insecure_server_url"; message: string }
  | { code: "invalid_credentials"; message: string }
  | { code: "maintenance"; message: string }
  | { code: "unsupported_response"; message: string }
  | { code: "unexpected_redirect"; message: string }
  | { code: "certificate"; message: string }
  | { code: "network"; message: string }
  | { code: "dns"; message: string }
  | { code: "timeout"; message: string }
  | { code: "connection_refused"; message: string }
  | { code: "server"; message: string }
  | { code: "login_expired"; message: string }
  | { code: "login_cancelled"; message: string }
  | { code: "account_already_configured"; message: string }
  | { code: "account_not_configured"; message: string }
  | { code: "account_storage"; message: string }
  | { code: "dav_permission"; message: string }
  | { code: "dav_not_found"; message: string }
  | { code: "dav_invalid_path"; message: string }
  | { code: "dav_quota"; message: string }
  | { code: "native_failure"; message: string };

export type EngineCommandResult = { ok: true } | { ok: false; error: EngineError };
export type EngineValueResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: EngineError };
