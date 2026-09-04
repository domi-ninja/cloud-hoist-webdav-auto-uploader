import { NativeModule, requireNativeModule } from "expo";
import { z } from "zod";

import {
  activityEntrySchema,
  engineSnapshotSchema,
  snapshotInvalidatedSchema,
  sourceInputSchema,
  sourceSummarySchema,
  unresolvedFailureSchema,
  type ActivityEntry,
  type EngineCommandResult,
  type EngineError,
  type EngineSnapshot,
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

  if (parsed.data.code === "ERR_ENGINE_SOURCE_NOT_FOUND") {
    return { code: "source_not_found", message: parsed.data.message };
  }

  if (parsed.data.code === "ERR_ENGINE_INVALID_INPUT") {
    return { code: "invalid_input", message: parsed.data.message };
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

  addSnapshotInvalidatedListener(
    listener: (revision: number) => void,
  ) {
    return nativeModule.addListener("onSnapshotInvalidated", (payload) => {
      listener(snapshotInvalidatedSchema.parse(payload).revision);
    });
  },
};
