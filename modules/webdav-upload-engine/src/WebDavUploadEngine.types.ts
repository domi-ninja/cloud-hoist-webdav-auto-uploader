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
  z.object({
    state: z.literal("blocked"),
    blockerCount: z.number().int().nonnegative(),
  }),
]);

export const sourceSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["media_store", "saf"]),
  localUri: z.string().min(1),
  remotePath: z.string().startsWith("/"),
  enabled: z.boolean(),
  collisionPolicy: z.enum(["replace", "keep_both"]),
  lastScanAt: z.string().datetime().nullable(),
  queue: z
    .object({
      uploaded: z.number().int().nonnegative().optional(),
      pending: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
    })
    .optional(),
});

export const queueCountsSchema = z.object({
  estimatedRemainingSeconds: z.number().nonnegative().nullable().optional(),
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
  z.object({
    status: z.literal("uploaded"),
    uploadedAt: z.string().datetime(),
  }),
  z.object({
    status: z.literal("failed"),
    code: z.string().min(1),
    message: z.string().optional(),
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
  z.object({
    kind: z.literal("job"),
    jobId: z.string().min(1),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
]);

export const workerActivitySchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("idle") }),
  z.object({
    state: z.literal("scanning"),
    scope: z.enum(["media", "all"]),
    startedAt: z.string().datetime(),
  }),
  z.object({
    state: z.literal("uploading"),
    jobId: z.string().min(1),
    bytesSent: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
  }),
  z.object({ state: z.literal("waiting"), reason: z.string().min(1) }),
  z.object({ state: z.literal("stopped"), reason: z.string().min(1) }),
]);

export const transferConstraintsSchema = z.object({
  unmeteredOnly: z.boolean(),
  batteryNotLow: z.boolean(),
  requiresCharging: z.boolean(),
});

export const schedulerStatusSchema = z.object({
  pausedAt: z.string().datetime().nullable(),
  lastScanRequestedAt: z.string().datetime().nullable(),
  lastScanCompletedAt: z.string().datetime().nullable(),
  workerState: z.enum(["idle", "scanning"]),
  workerScope: z.enum(["media", "all"]).nullable(),
  constraints: transferConstraintsSchema,
});

export const activityEntrySchema = z.object({
  id: z.string().min(1),
  type: z.enum(["scan", "upload", "pause", "resume", "source_changed"]),
  message: z.string(),
  occurredAt: z.string().datetime(),
});

export const activityPageSchema = z.object({
  items: activityEntrySchema.array(),
  nextOffset: z.number().int().nonnegative().nullable(),
});

export const filePresenceSchema = z.enum(["local_only", "remote_only", "both"]);

export const fileInventoryFilterSchema = z.object({
  sourceId: z.string().uuid().nullable(),
  status: z.enum(["all", "pending", "failed", "uploaded"]),
});

export type FileInventoryFilter = z.infer<typeof fileInventoryFilterSchema>;

export const fileInventoryEntrySchema = z.object({
  jobId: z.string().nullable().optional(),
  id: z.string().min(1),
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  fileName: z.string().min(1),
  relativePath: z.string().min(1),
  remotePath: z.string().startsWith("/"),
  localUri: z.string().nullable(),
  mimeType: z.string().nullable(),
  byteCount: z.number().int().nonnegative().nullable(),
  modifiedAt: z.string().datetime().nullable(),
  presence: filePresenceSchema,
  transfer: jobStateSchema.nullable(),
});

export const inventoryErrorSchema = z.object({
  sourceId: z.string().min(1),
  message: z.string().min(1),
});

export const fileInventoryPageSchema = z.object({
  items: fileInventoryEntrySchema.array(),
  errors: inventoryErrorSchema.array(),
  nextOffset: z.number().int().nonnegative().nullable(),
});

export const uploadDetailSchema = z.object({
  jobId: z.string(), sourceId: z.string(), fileName: z.string(), sourceName: z.string().nullable(),
  localUri: z.string().nullable(), byteCount: z.number().nonnegative(), remotePath: z.string(),
  state: z.enum(["queued", "running", "retry_wait", "blocked", "completed", "cancelled"]),
  attemptCount: z.number().int().nonnegative(), errorCode: z.string().nullable(), errorMessage: z.string().nullable(),
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
  scheduler: schedulerStatusSchema,
});

export const sourceInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  kind: z.enum(["media_store", "saf"]),
  localUri: z.string().min(1),
  remotePath: z.string().startsWith("/"),
  enabled: z.boolean(),
  collisionPolicy: z.enum(["replace", "keep_both"]),
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

export const selectedDocumentTreeSchema = z.object({
  treeUri: z.string().startsWith("content://"),
});

export const mediaFolderSchema = z.object({
  latestFileAt: z.string().datetime().nullable().optional(),
  volumeName: z.string().min(1),
  relativePath: z.string().min(1),
  fileCount: z.number().int().positive(),
  totalBytes: z.number().int().nonnegative(),
});
export type MediaFolder = z.infer<typeof mediaFolderSchema>;

export const sourceSelectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("media_folder"),
    volumeName: z.string().min(1),
    relativePath: z.string().min(1),
  }),
  z.object({ type: z.literal("camera") }),
  z.object({ type: z.literal("screenshots") }),
  z.object({
    type: z.literal("document_tree"),
    treeUri: z.string().startsWith("content://"),
  }),
]);

export const sourcePreviewSchema = z.object({
  nextOffset: z.number().int().nonnegative().nullable().optional(),
  eligibleFileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  permissionAccess: z.enum(["full", "partial", "denied"]).nullable(),
  files: z
    .array(
      z.object({
        localUri: z.string(),
        fileName: z.string(),
        mimeType: z.string().nullable(),
      }),
    )
    .default([]),
});

export const sourceCommitSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  selection: sourceSelectionSchema,
  remotePathSegments: remotePathSegmentsSchema,
  collisionPolicy: z.enum(["replace", "keep_both"]),
});

export const sourceCommitResultSchema = z.object({
  sourceId: z.string().uuid(),
  preview: sourcePreviewSchema,
  jobsAdded: z.number().int().nonnegative(),
});

export const mediaPermissionStateSchema = z.object({
  access: z.enum(["full", "partial", "denied"]),
  canAskAgain: z.boolean(),
});

export const notificationPermissionStateSchema = z.object({
  granted: z.boolean(),
  canAskAgain: z.boolean(),
});

export const sourceScanResultSchema = z.object({
  sourceId: z.string().uuid(),
  preview: sourcePreviewSchema.nullable(),
  revisionsAdded: z.number().int().nonnegative(),
  jobsAdded: z.number().int().nonnegative(),
  blocker: z
    .enum(["permission_revoked", "folder_unavailable", "unreadable_document"])
    .nullable(),
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
export type TransferConstraints = z.infer<typeof transferConstraintsSchema>;
export type SchedulerStatus = z.infer<typeof schedulerStatusSchema>;
export type ActivityEntry = z.infer<typeof activityEntrySchema>;
export type ActivityPage = z.infer<typeof activityPageSchema>;
export type FileInventoryEntry = z.infer<typeof fileInventoryEntrySchema>;
export type FileInventoryPage = z.infer<typeof fileInventoryPageSchema>;
export type UnresolvedFailure = z.infer<typeof unresolvedFailureSchema>;
export type EngineSnapshot = z.infer<typeof engineSnapshotSchema>;
export type SourceInput = z.infer<typeof sourceInputSchema>;
export type SnapshotInvalidated = z.infer<typeof snapshotInvalidatedSchema>;
export type ManualAccountInput = z.infer<typeof manualAccountInputSchema>;
export type LoginFlowStart = z.infer<typeof loginFlowStartSchema>;
export type LoginFlowPoll = z.infer<typeof loginFlowPollSchema>;
export type RemoteFolder = z.infer<typeof remoteFolderSchema>;
export type SelectedDocumentTree = z.infer<typeof selectedDocumentTreeSchema>;
export type SourceSelection = z.infer<typeof sourceSelectionSchema>;
export type SourcePreview = z.infer<typeof sourcePreviewSchema>;
export type SourceCommit = z.infer<typeof sourceCommitSchema>;
export type SourceCommitResult = z.infer<typeof sourceCommitResultSchema>;
export type MediaPermissionState = z.infer<typeof mediaPermissionStateSchema>;
export type NotificationPermissionState = z.infer<
  typeof notificationPermissionStateSchema
>;
export type SourceScanResult = z.infer<typeof sourceScanResultSchema>;

export type WebDavUploadEngineModuleEvents = {
  onSnapshotInvalidated: (payload: SnapshotInvalidated) => void;
};

export type EngineError = {
  code:
    | "source_not_found"
    | "invalid_input"
    | "invalid_server_url"
    | "insecure_server_url"
    | "invalid_credentials"
    | "maintenance"
    | "unsupported_response"
    | "unexpected_redirect"
    | "certificate"
    | "network"
    | "dns"
    | "timeout"
    | "connection_refused"
    | "server"
    | "login_expired"
    | "login_cancelled"
    | "account_already_configured"
    | "account_not_configured"
    | "account_storage"
    | "dav_permission"
    | "dav_not_found"
    | "dav_invalid_path"
    | "dav_quota"
    | "source_permission_revoked"
    | "source_folder_unavailable"
    | "source_unreadable_document"
    | "native_failure";
  message: string;
};

export type EngineCommandResult =
  | { ok: true }
  | { ok: false; error: EngineError };
export type EngineValueResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: EngineError };

export const destinationChangeRequestSchema = z.object({
  sourceId: z.string().optional(),
  pathSegments: remotePathSegmentsSchema,
  rootChange: z.boolean(),
});
export const destinationChangeSchema = z.object({
  id: z.string(),
  state: z.enum(["running", "failed", "completed"]),
  mode: z.enum(["move", "copy"]),
  routes: z.object({ sourceId: z.string(), name: z.string(), from: remotePathSegmentsSchema, to: remotePathSegmentsSchema }).array(),
  total: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  root: remotePathSegmentsSchema.nullable(),
  message: z.string().nullable(),
  errorSourceId: z.string().nullable(),
  errorFile: z.string().nullable(),
});
export type DestinationChangeRequest = z.infer<typeof destinationChangeRequestSchema>;
export type DestinationChange = z.infer<typeof destinationChangeSchema>;
