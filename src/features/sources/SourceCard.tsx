import { useState } from "react";
import { Alert, Switch, Text, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type EngineSnapshot,
  type SourceSummary,
} from "../../../modules/webdav-upload-engine";
import { formatRelativeTime } from "@/lib/format";
import { RemoteFolderPicker } from "./RemoteFolderPicker";
import { ActionButton, Panel, Separator } from "@/components/ui";

type SourceCardProps = {
  snapshot: EngineSnapshot;
  source: SourceSummary;
  now: number;
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

export function SourceCard({ snapshot, source, now }: SourceCardProps) {
  const [editingDestination, setEditingDestination] = useState(false);
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

  const restorePermission = async () => {
    if (!permissionBlocker) return;
    setBusy(true);
    setError(undefined);

    if (permissionBlocker.permission === "media") {
      const permission = await webDavUploadEngine.requestMediaPermission();
      if (!permission.ok) {
        setBusy(false);
        setError(permission.error);
        return;
      }
    } else {
      const selection = await webDavUploadEngine.pickDocumentTree(source.localUri);
      if (!selection.ok) {
        setBusy(false);
        setError(selection.error);
        return;
      }
      if (!selection.value) {
        setBusy(false);
        return;
      }
      const updated = await webDavUploadEngine.addOrUpdateSource({
        ...source,
        localUri: selection.value.treeUri,
      });
      if (!updated.ok) {
        setBusy(false);
        setError(updated.error);
        return;
      }
    }

    const scan = await webDavUploadEngine.scanSource(source.id);
    setBusy(false);
    if (!scan.ok) setError(scan.error);
  };

  const resetHistory = () => {
    Alert.alert(
      "Upload existing files again?",
      "The next scan will reconsider files from this source. Files already on the server may be overwritten.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset history",
          style: "destructive",
          onPress: () => void run(() => webDavUploadEngine.resetSourceHistory(source.id)),
        },
      ],
    );
  };

  const remove = () => {
    Alert.alert(
      `Remove ${source.name}?`,
      "This stops watching the source. Files already uploaded to Nextcloud are not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void run(() => webDavUploadEngine.removeSource(source.id)),
        },
      ],
    );
  };

  if (editingDestination) {
    return (
      <View className="gap-4">
        <RemoteFolderPicker
          onSelect={(pathSegments) => {
            const remotePath = pathSegments.length ? `/${pathSegments.join("/")}` : "/";
            void updateSource({ remotePath }).then((saved) => {
              if (saved) setEditingDestination(false);
            });
          }}
        />
        <ActionButton
          accessibilityLabel={`Cancel editing ${source.name}`}
          disabled={busy}
          label="Cancel"
          onPress={() => setEditingDestination(false)}
        />
      </View>
    );
  }

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
        Upload to {source.remotePath}
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
        <ActionButton
          accessibilityLabel={`Restore permission for ${source.name}`}
          disabled={busy}
          label="Restore permission"
          onPress={() => void restorePermission()}
          tone="primary"
        />
      ) : null}
      {busy ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-muted-light dark:text-muted-dark"
        >
          Working…
        </Text>
      ) : null}
      <View className="gap-4">
        <ActionButton
          accessibilityLabel={`Scan ${source.name}`}
          disabled={busy || !source.enabled}
          label="Scan source"
          onPress={() => void run(() => webDavUploadEngine.scanSource(source.id))}
          tone={permissionBlocker ? "secondary" : "primary"}
        />
        <ActionButton
          accessibilityLabel={`Edit destination for ${source.name}`}
          disabled={busy}
          label="Change destination"
          onPress={() => setEditingDestination(true)}
        />
      </View>
      <Separator />
      <Text className="text-base text-muted-light dark:text-muted-dark">
        Source maintenance
      </Text>
      <View className="gap-4">
        <ActionButton
          accessibilityLabel={`Reset upload history for ${source.name}`}
          disabled={busy}
          label="Reset upload history"
          onPress={resetHistory}
        />
        <ActionButton
          accessibilityLabel={`Remove ${source.name}`}
          disabled={busy}
          label="Remove source"
          onPress={remove}
          tone="danger"
        />
      </View>
    </Panel>
  );
}
