import { useState } from "react";
import { Text, View } from "react-native";
import { Switch } from "react-native-paper";

import webDavUploadEngine, {
  type EngineError,
  type EngineSnapshot,
  type SourceSummary,
} from "../../../modules/webdav-upload-engine";
import { formatRelativeTime } from "@/lib/format";
import { IconAction, Panel } from "@/components/ui";
import { RestoreSourcePermission } from "./RestoreSourcePermission";
import { sourceLocalLabel } from "./source-editor-state";

type SourceCardProps = {
  snapshot: EngineSnapshot;
  source: SourceSummary;
  now: number;
  onEdit: () => void;
};

function sourceStatus(
  snapshot: EngineSnapshot,
  source: SourceSummary,
  now: number,
) {
  const permissionBlocker = snapshot.blockers.some(
    (blocker) =>
      blocker.kind === "permission" && blocker.sourceId === source.id,
  );
  const worker = snapshot.worker;
  const activeJob =
    worker.state === "uploading"
      ? snapshot.recentJobs.find((job) => job.id === worker.jobId)
      : undefined;

  if (permissionBlocker) return "Permission required";
  if (!source.enabled) return "Disabled";
  if (snapshot.engine.state === "paused") return "Paused";
  if (snapshot.worker.state === "waiting") return snapshot.worker.reason;
  if (
    snapshot.worker.state === "scanning" &&
    (snapshot.worker.scope === "all" || source.kind === "media_store")
  ) {
    return "Scanning";
  }
  if (activeJob?.sourceId === source.id) return "Uploading";
  if (snapshot.blockers.some((blocker) => blocker.kind === "network")) {
    return "Waiting for network";
  }
  if (source.lastScanAt) {
    return `Last scanned ${formatRelativeTime(source.lastScanAt, now)}`;
  }
  return "Ready to scan";
}

export function SourceCard({ snapshot, source, now, onEdit }: SourceCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError>();
  const permissionBlocker = snapshot.blockers.find(
    (
      blocker,
    ): blocker is Extract<
      EngineSnapshot["blockers"][number],
      { kind: "permission" }
    > => blocker.kind === "permission" && blocker.sourceId === source.id,
  );

  const run = async (
    command: () => Promise<{ ok: true } | { ok: false; error: EngineError }>,
  ) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await command();
      if (!result.ok) setError(result.error);
      return result.ok;
    } catch {
      setError({
        code: "native_failure",
        message: "Could not update this backup folder. Please try again.",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const updateSource = (changes: Partial<SourceSummary>) =>
    run(() => webDavUploadEngine.addOrUpdateSource({ ...source, ...changes }));

  return (
    <Panel>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="shrink text-base font-semibold text-ink-light dark:text-ink-dark">
          {source.name}
        </Text>
        <View className="flex-row items-center gap-2">
          <IconAction
            icon="pencil-outline"
            accessibilityLabel={`Edit ${source.name}`}
            disabled={busy}
            label="Edit"
            onPress={onEdit}
          />
          <Switch
            hitSlop={8}
            accessibilityLabel={`${source.enabled ? "Disable" : "Enable"} ${source.name}`}
            disabled={busy}
            onValueChange={(enabled) => void updateSource({ enabled })}
            value={source.enabled}
          />
        </View>
      </View>
      <Text className="text-base text-muted-light dark:text-muted-dark">
        {sourceStatus(snapshot, source, now)}
      </Text>
      {source.queue && (source.queue.pending > 0 || source.queue.failed > 0) ? (
        <Text className="text-base text-muted-light dark:text-muted-dark">
          {[
            source.queue.pending ? `${source.queue.pending} pending` : null,
            source.queue.failed ? `${source.queue.failed} failed` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      ) : null}
      <Text className="text-base text-muted-light dark:text-muted-dark">
        {sourceLocalLabel(source)} → {source.remotePath}
      </Text>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-red-700 dark:text-red-300"
        >
          {error.message}
        </Text>
      ) : null}
      {permissionBlocker ? (
        <RestoreSourcePermission blocker={permissionBlocker} source={source} />
      ) : null}
      {busy ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-muted-light dark:text-muted-dark"
        >
          Working…
        </Text>
      ) : null}
    </Panel>
  );
}
