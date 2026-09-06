import { useState } from "react";
import { Switch, Text, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type EngineSnapshot,
  type SourceSummary,
} from "../../../modules/webdav-upload-engine";
import { formatRelativeTime } from "@/lib/format";
import { ActionButton, Panel } from "@/components/ui";
import { RestoreSourcePermission } from "./RestoreSourcePermission";
import { sourceLocalLabel } from "./source-editor-state";

type SourceCardProps = {
  snapshot: EngineSnapshot;
  source: SourceSummary;
  now: number;
  onEdit: () => void;
};

function sourceStatus(snapshot: EngineSnapshot, source: SourceSummary, now: number) {
  const permissionBlocker = snapshot.blockers.some(
    (blocker) => blocker.kind === "permission" && blocker.sourceId === source.id,
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
    ): blocker is Extract<EngineSnapshot["blockers"][number], { kind: "permission" }> =>
      blocker.kind === "permission" && blocker.sourceId === source.id,
  );

  const run = async (
    command: () => Promise<{ ok: true } | { ok: false; error: EngineError }>,
  ) => {
    setBusy(true);
    setError(undefined);
    const result = await command();
    setBusy(false);
    if (!result.ok) setError(result.error);
    return result.ok;
  };

  const updateSource = (changes: Partial<SourceSummary>) =>
    run(() => webDavUploadEngine.addOrUpdateSource({ ...source, ...changes }));

  return (
    <Panel>
      <View className="flex-row items-center justify-between gap-4">
        <Text className="shrink text-base font-semibold text-ink-light dark:text-ink-dark">
          {source.name}
        </Text>
        <Switch
          accessibilityLabel={`${source.enabled ? "Disable" : "Enable"} ${source.name}`}
          disabled={busy}
          onValueChange={(enabled) => void updateSource({ enabled })}
          thumbColor="#f4f4f0"
          trackColor={{ false: "#62665d", true: "#4f7d45" }}
          value={source.enabled}
        />
      </View>
      <Text className="text-base text-muted-light dark:text-muted-dark">
        {sourceStatus(snapshot, source, now)}
      </Text>
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
      <View className="flex-row flex-wrap items-center gap-4">
        <ActionButton
          accessibilityLabel={`Scan ${source.name}`}
          disabled={busy || !source.enabled}
          label="Scan"
          onPress={() => void run(() => webDavUploadEngine.scanSource(source.id))}
          tone={permissionBlocker ? "secondary" : "primary"}
        />
        <ActionButton
          accessibilityLabel={`Edit ${source.name}`}
          disabled={busy}
          label="Edit"
          onPress={onEdit}
        />
      </View>
    </Panel>
  );
}
