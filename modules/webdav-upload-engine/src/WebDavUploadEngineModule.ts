import { NativeModule, requireNativeModule } from "expo";
import { z } from "zod";

import {
  activityEntrySchema,
  accountSummarySchema,
  engineSnapshotSchema,
  loginFlowPollSchema,
  loginFlowStartSchema,
  manualAccountInputSchema,
  snapshotInvalidatedSchema,
  sourceInputSchema,
  sourceSummarySchema,
  unresolvedFailureSchema,
  type ActivityEntry,
  type AccountSummary,
  type EngineCommandResult,
  type EngineError,
  type EngineSnapshot,
  type EngineValueResult,
  type LoginFlowPoll,
  type LoginFlowStart,
  type ManualAccountInput,
  type SourceInput,
  type SourceSummary,
  type UnresolvedFailure,
  type WebDavUploadEngineModuleEvents,
} from "./WebDavUploadEngine.types";

declare class NativeWebDavUploadEngine extends NativeModule<WebDavUploadEngineModuleEvents> {
  getSnapshotAsync(): Promise<unknown>;
  getSourcesAsync(): Promise<unknown>;
  getRecentActivityAsync(): Promise<unknown>;
  getUnresolvedFailuresAsync(): Promise<unknown>;
  pauseAsync(): Promise<void>;
  resumeAsync(): Promise<void>;
  scanNowAsync(): Promise<void>;
  retryFailedAsync(): Promise<void>;
  addOrUpdateSourceAsync(source: SourceInput): Promise<void>;
  removeSourceAsync(sourceId: string): Promise<void>;
  resetSourceHistoryAsync(sourceId: string): Promise<void>;
  connectManualAsync(input: ManualAccountInput): Promise<unknown>;
  startLoginFlowAsync(serverUrl: string): Promise<unknown>;
  pollLoginFlowAsync(attemptId: string): Promise<unknown>;
  cancelLoginFlowAsync(attemptId: string): Promise<void>;
  verifyStoredAccountAsync(): Promise<unknown>;
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
  async getSnapshot(): Promise<EngineSnapshot> {
    return engineSnapshotSchema.parse(await nativeModule.getSnapshotAsync());
  },

  async getSources(): Promise<SourceSummary[]> {
    return sourceSummarySchema.array().parse(await nativeModule.getSourcesAsync());
  },

  async getRecentActivity(): Promise<ActivityEntry[]> {
    return activityEntrySchema.array().parse(await nativeModule.getRecentActivityAsync());
  },

  async getUnresolvedFailures(): Promise<UnresolvedFailure[]> {
    return unresolvedFailureSchema
      .array()
      .parse(await nativeModule.getUnresolvedFailuresAsync());
  },

  pause: () => runCommand(() => nativeModule.pauseAsync()),
  resume: () => runCommand(() => nativeModule.resumeAsync()),
  scanNow: () => runCommand(() => nativeModule.scanNowAsync()),
  retryFailed: () => runCommand(() => nativeModule.retryFailedAsync()),
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

  addSnapshotInvalidatedListener(
    listener: (revision: number) => void,
  ) {
    return nativeModule.addListener("onSnapshotInvalidated", (payload) => {
      listener(snapshotInvalidatedSchema.parse(payload).revision);
    });
  },
};
