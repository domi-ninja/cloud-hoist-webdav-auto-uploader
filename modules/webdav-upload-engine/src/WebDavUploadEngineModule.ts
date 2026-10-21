import { NativeModule, requireNativeModule } from "expo";
import { z } from "zod";

import {
  mediaFolderSchema,
  uploadDetailSchema,
  activityPageSchema,
  fileInventoryPageSchema,
  fileInventoryFilterSchema,
  type FileInventoryFilter,
  accountSummarySchema,
  engineSnapshotSchema,
  loginFlowPollSchema,
  loginFlowStartSchema,
  manualAccountInputSchema,
  mediaPermissionStateSchema,
  notificationPermissionStateSchema,
  remoteFolderSchema,
  remotePathSegmentSchema,
  remotePathSegmentsSchema,
  snapshotInvalidatedSchema,
  sourceInputSchema,
  sourceSummarySchema,
  selectedDocumentTreeSchema,
  sourceCommitResultSchema,
  sourceCommitSchema,
  sourcePreviewSchema,
  sourceSelectionSchema,
  sourceScanResultSchema,
  transferConstraintsSchema,
  unresolvedFailureSchema,
  type ActivityPage,
  type FileInventoryPage,
  type AccountSummary,
  type EngineCommandResult,
  type EngineError,
  type EngineSnapshot,
  type EngineValueResult,
  type LoginFlowPoll,
  type LoginFlowStart,
  type ManualAccountInput,
  type MediaPermissionState,
  type NotificationPermissionState,
  type RemoteFolder,
  type SelectedDocumentTree,
  type SourceCommit,
  type SourceCommitResult,
  type SourcePreview,
  type SourceSelection,
  type SourceScanResult,
  type SourceInput,
  type SourceSummary,
  type TransferConstraints,
  type UnresolvedFailure,
  type WebDavUploadEngineModuleEvents,
} from "./WebDavUploadEngine.types";

declare class NativeWebDavUploadEngine extends NativeModule<WebDavUploadEngineModuleEvents> {
  openPlayStoreAsync(androidPackage: string): Promise<boolean>;
  getSnapshotAsync(): Promise<unknown>;
  getSourcesAsync(): Promise<unknown>;
  getActivityPageAsync(offset: number): Promise<unknown>;
  getFileInventoryPageAsync(offset: number, filter: FileInventoryFilter): Promise<unknown>;
  getRemoteThumbnailAsync(
    sourceId: string,
    relativePath: string,
    version: string | null,
  ): Promise<unknown>;
  getUnresolvedFailuresAsync(): Promise<unknown>;
  getDiagnosticReportAsync(): Promise<unknown>;
  pauseAsync(): Promise<void>;
  resumeAsync(): Promise<void>;
  scanNowAsync(): Promise<void>;
  getUploadDetailAsync(jobId: string): Promise<unknown>;
  retryUploadAsync(jobId: string): Promise<void>;
  retryFailedAsync(): Promise<void>;
  clearCompletedHistoryAsync(): Promise<void>;
  setTransferConstraintsAsync(input: TransferConstraints): Promise<void>;
  addOrUpdateSourceAsync(source: SourceInput): Promise<void>;
  removeSourceAsync(sourceId: string): Promise<void>;
  resetSourceHistoryAsync(sourceId: string): Promise<void>;
  connectManualAsync(input: ManualAccountInput): Promise<unknown>;
  replaceManualAccountAsync(input: ManualAccountInput): Promise<unknown>;
  startLoginFlowAsync(serverUrl: string): Promise<unknown>;
  pollLoginFlowAsync(attemptId: string): Promise<unknown>;
  cancelLoginFlowAsync(attemptId: string): Promise<void>;
  verifyStoredAccountAsync(): Promise<unknown>;
  signOutAsync(): Promise<void>;
  listRemoteFoldersAsync(pathSegments: string[]): Promise<unknown>;
  createRemoteFolderAsync(parentPathSegments: string[], name: string): Promise<unknown>;
  pickDocumentTreeAsync(initialUri: string | null): Promise<unknown>;
  getMediaFoldersAsync(): Promise<unknown>;
  getLocalVideoThumbnailAsync(uri: string): Promise<unknown>;
  openLocalVideoAsync(uri: string): Promise<void>;
  previewSourceAsync(selection: SourceSelection, offset: number): Promise<unknown>;
  commitSourceAsync(source: SourceCommit): Promise<unknown>;
  getMediaPermissionAsync(): Promise<unknown>;
  requestMediaPermissionAsync(): Promise<unknown>;
  getNotificationPermissionAsync(): Promise<unknown>;
  requestNotificationPermissionAsync(): Promise<unknown>;
  scanSourceAsync(sourceId: string): Promise<unknown>;
}

const nativeModule =
  requireNativeModule<NativeWebDavUploadEngine>("WebDavUploadEngine");

const nativeErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

function normalizeError(error: unknown): EngineError {
  const parsed = nativeErrorSchema.safeParse(error);
  if (!parsed.success) {
    return { code: "native_failure", message: "The native engine command failed." };
  }

  const knownCodes = {
    ERR_ENGINE_SOURCE_NOT_FOUND: "source_not_found",
    ERR_ENGINE_INVALID_INPUT: "invalid_input",
    ERR_ACCOUNT_INVALID_SERVER_URL: "invalid_server_url",
    ERR_ACCOUNT_INSECURE_SERVER_URL: "insecure_server_url",
    ERR_ACCOUNT_INVALID_CREDENTIALS: "invalid_credentials",
    ERR_ACCOUNT_MAINTENANCE: "maintenance",
    ERR_ACCOUNT_UNSUPPORTED_RESPONSE: "unsupported_response",
    ERR_ACCOUNT_UNEXPECTED_REDIRECT: "unexpected_redirect",
    ERR_ACCOUNT_CERTIFICATE: "certificate",
    ERR_ACCOUNT_NETWORK: "network",
    ERR_ACCOUNT_DNS: "dns",
    ERR_ACCOUNT_TIMEOUT: "timeout",
    ERR_ACCOUNT_CONNECTION_REFUSED: "connection_refused",
    ERR_ACCOUNT_SERVER: "server",
    ERR_ACCOUNT_LOGIN_EXPIRED: "login_expired",
    ERR_ACCOUNT_LOGIN_CANCELLED: "login_cancelled",
    ERR_ACCOUNT_ALREADY_CONFIGURED: "account_already_configured",
    ERR_ACCOUNT_NOT_CONFIGURED: "account_not_configured",
    ERR_ACCOUNT_STORAGE: "account_storage",
    ERR_DAV_PERMISSION: "dav_permission",
    ERR_DAV_NOT_FOUND: "dav_not_found",
    ERR_DAV_INVALID_PATH: "dav_invalid_path",
    ERR_DAV_QUOTA: "dav_quota",
    ERR_SOURCE_PERMISSION_REVOKED: "source_permission_revoked",
    ERR_SOURCE_FOLDER_UNAVAILABLE: "source_folder_unavailable",
    ERR_SOURCE_UNREADABLE_DOCUMENT: "source_unreadable_document",
  } as const satisfies Record<string, EngineError["code"]>;
  const code = knownCodes[parsed.data.code as keyof typeof knownCodes];
  if (code) {
    return { code, message: parsed.data.message };
  }

  return { code: "native_failure", message: parsed.data.message };
}

async function runCommand(command: () => Promise<void>): Promise<EngineCommandResult> {
  try {
    await command();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}

async function runValueCommand<T>(
  command: () => Promise<unknown>,
  decode: (value: unknown) => T,
): Promise<EngineValueResult<T>> {
  try {
    return { ok: true, value: decode(await command()) };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}

export const webDavUploadEngine = {
  openPlayStore: (androidPackage: string) => runValueCommand(
    () => nativeModule.openPlayStoreAsync(androidPackage),
    (value) => z.boolean().parse(value),
  ),
  async getSnapshot(): Promise<EngineSnapshot> {
    return engineSnapshotSchema.parse(await nativeModule.getSnapshotAsync());
  },

  async getSources(): Promise<SourceSummary[]> {
    return sourceSummarySchema.array().parse(await nativeModule.getSourcesAsync());
  },

  async getActivityPage(offset = 0): Promise<ActivityPage> {
    const parsedOffset = z.number().int().nonnegative().parse(offset);
    return activityPageSchema.parse(await nativeModule.getActivityPageAsync(parsedOffset));
  },

  async getFileInventoryPage(
    offset = 0,
    filter: FileInventoryFilter = { sourceId: null, status: "all" },
  ): Promise<FileInventoryPage> {
    const parsedOffset = z.number().int().nonnegative().parse(offset);
    return fileInventoryPageSchema.parse(
      await nativeModule.getFileInventoryPageAsync(parsedOffset, fileInventoryFilterSchema.parse(filter)),
    );
  },

  getRemoteThumbnail: (
    sourceId: string,
    relativePath: string,
    version: string | null,
  ) =>
    runValueCommand(
      () => nativeModule.getRemoteThumbnailAsync(sourceId, relativePath, version),
      (value): string | null => z.string().startsWith("file:").nullable().parse(value),
    ),

  async getUnresolvedFailures(): Promise<UnresolvedFailure[]> {
    return unresolvedFailureSchema
      .array()
      .parse(await nativeModule.getUnresolvedFailuresAsync());
  },

  getDiagnosticReport: () =>
    runValueCommand(
      () => nativeModule.getDiagnosticReportAsync(),
      (value): string => z.string().min(1).parse(value),
    ),

  pause: () => runCommand(() => nativeModule.pauseAsync()),
  resume: () => runCommand(() => nativeModule.resumeAsync()),
  scanNow: () => runCommand(() => nativeModule.scanNowAsync()),
  retryFailed: () => runCommand(() => nativeModule.retryFailedAsync()),
  clearCompletedHistory: () =>
    runCommand(() => nativeModule.clearCompletedHistoryAsync()),
  setTransferConstraints: (input: TransferConstraints) => {
    const constraints = transferConstraintsSchema.parse(input);
    return runCommand(() => nativeModule.setTransferConstraintsAsync(constraints));
  },
  addOrUpdateSource: (source: SourceInput) => {
    const input = sourceInputSchema.parse(source);
    return runCommand(() => nativeModule.addOrUpdateSourceAsync(input));
  },
  removeSource: (sourceId: string) =>
    runCommand(() => nativeModule.removeSourceAsync(sourceId)),
  resetSourceHistory: (sourceId: string) =>
    runCommand(() => nativeModule.resetSourceHistoryAsync(sourceId)),

  connectManual: (input: ManualAccountInput) => {
    const parsedInput = manualAccountInputSchema.parse(input);
    return runValueCommand(
      () => nativeModule.connectManualAsync(parsedInput),
      (value): AccountSummary => accountSummarySchema.parse(value),
    );
  },
  replaceManualAccount: (input: ManualAccountInput) => {
    const parsedInput = manualAccountInputSchema.parse(input);
    return runValueCommand(
      () => nativeModule.replaceManualAccountAsync(parsedInput),
      (value): AccountSummary => accountSummarySchema.parse(value),
    );
  },
  startLoginFlow: (serverUrl: string) =>
    runValueCommand(
      () => nativeModule.startLoginFlowAsync(serverUrl),
      (value): LoginFlowStart => loginFlowStartSchema.parse(value),
    ),
  pollLoginFlow: (attemptId: string) =>
    runValueCommand(
      () => nativeModule.pollLoginFlowAsync(attemptId),
      (value): LoginFlowPoll => loginFlowPollSchema.parse(value),
    ),
  cancelLoginFlow: (attemptId: string) =>
    runCommand(() => nativeModule.cancelLoginFlowAsync(attemptId)),
  verifyStoredAccount: () =>
    runValueCommand(
      () => nativeModule.verifyStoredAccountAsync(),
      (value): AccountSummary => accountSummarySchema.parse(value),
    ),
  signOut: () => runCommand(() => nativeModule.signOutAsync()),
  listRemoteFolders: (pathSegments: string[]) => {
    const path = remotePathSegmentsSchema.parse(pathSegments);
    return runValueCommand(
      () => nativeModule.listRemoteFoldersAsync(path),
      (value): RemoteFolder[] => remoteFolderSchema.array().parse(value),
    );
  },
  createRemoteFolder: (parentPathSegments: string[], name: string) => {
    const parent = remotePathSegmentsSchema.parse(parentPathSegments);
    const folderName = remotePathSegmentSchema.parse(name);
    return runValueCommand(
      () => nativeModule.createRemoteFolderAsync(parent, folderName),
      (value): RemoteFolder => remoteFolderSchema.parse(value),
    );
  },
  pickDocumentTree: (initialUri: string | null = null) =>
    runValueCommand(
      () => nativeModule.pickDocumentTreeAsync(initialUri),
      (value): SelectedDocumentTree | null =>
        selectedDocumentTreeSchema.nullable().parse(value),
    ),
  getUploadDetail: (jobId: string) => runValueCommand(
    () => nativeModule.getUploadDetailAsync(jobId), (value) => uploadDetailSchema.nullable().parse(value),
  ),
  retryUpload: (jobId: string) => runCommand(() => nativeModule.retryUploadAsync(jobId)),
  getMediaFolders: () => runValueCommand(
    () => nativeModule.getMediaFoldersAsync(),
    (value) => mediaFolderSchema.array().parse(value),
  ),
  getLocalVideoThumbnail: (uri: string) => runValueCommand(
    () => nativeModule.getLocalVideoThumbnailAsync(uri),
    (value) => z.string().startsWith("data:image/jpeg;base64,").nullable().parse(value),
  ),
  openLocalVideo: (uri: string) => runCommand(() => nativeModule.openLocalVideoAsync(uri)),
  previewSource: (selection: SourceSelection, offset = 0) => {
    const input = sourceSelectionSchema.parse(selection);
    return runValueCommand(
      () => nativeModule.previewSourceAsync(input, offset),
      (value): SourcePreview => sourcePreviewSchema.parse(value),
    );
  },
  commitSource: (source: SourceCommit) => {
    const input = sourceCommitSchema.parse(source);
    return runValueCommand(
      () => nativeModule.commitSourceAsync(input),
      (value): SourceCommitResult => sourceCommitResultSchema.parse(value),
    );
  },
  getMediaPermission: () =>
    runValueCommand(
      () => nativeModule.getMediaPermissionAsync(),
      (value): MediaPermissionState => mediaPermissionStateSchema.parse(value),
    ),
  requestMediaPermission: () =>
    runValueCommand(
      () => nativeModule.requestMediaPermissionAsync(),
      (value): MediaPermissionState => mediaPermissionStateSchema.parse(value),
    ),
  getNotificationPermission: () =>
    runValueCommand(
      () => nativeModule.getNotificationPermissionAsync(),
      (value): NotificationPermissionState =>
        notificationPermissionStateSchema.parse(value),
    ),
  requestNotificationPermission: () =>
    runValueCommand(
      () => nativeModule.requestNotificationPermissionAsync(),
      (value): NotificationPermissionState =>
        notificationPermissionStateSchema.parse(value),
    ),
  scanSource: (sourceId: string) =>
    runValueCommand(
      () => nativeModule.scanSourceAsync(z.string().uuid().parse(sourceId)),
      (value): SourceScanResult => sourceScanResultSchema.parse(value),
    ),

  addSnapshotInvalidatedListener(
    listener: (revision: number) => void,
  ) {
    return nativeModule.addListener("onSnapshotInvalidated", (payload) => {
      listener(snapshotInvalidatedSchema.parse(payload).revision);
    });
  },
};
