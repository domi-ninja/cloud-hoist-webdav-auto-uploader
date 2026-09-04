import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type EngineSnapshot,
  type SourceSummary,
} from "../../../modules/webdav-upload-engine";
import { formatRelativeTime } from "@/lib/format";
import { RemoteFolderPicker } from "./RemoteFolderPicker";

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
        <Pressable
          accessibilityLabel={`Cancel editing ${source.name}`}
          accessibilityRole="button"
          className="p-4"
          disabled={busy}
          onPress={() => setEditingDestination(false)}
        >
          <Text className="text-base text-muted-light dark:text-muted-dark">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-4 border border-accent p-4">
      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
        {source.name}
      </Text>
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
        <Pressable
          accessibilityLabel={`Restore permission for ${source.name}`}
          accessibilityRole="button"
          className="bg-accent p-4 disabled:opacity-50"
          disabled={busy}
          onPress={() => void restorePermission()}
        >
          <Text className="text-base font-semibold text-canvas-dark">
            Restore permission
          </Text>
        </Pressable>
      ) : null}
      {busy ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-muted-light dark:text-muted-dark"
        >
          Working…
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-4">
        <Pressable
          accessibilityLabel={`Scan ${source.name}`}
          accessibilityRole="button"
          className="min-w-40 grow border border-accent p-4 disabled:opacity-50"
          disabled={busy || !source.enabled}
          onPress={() => void run(() => webDavUploadEngine.scanSource(source.id))}
        >
          <Text className="text-base text-ink-light dark:text-ink-dark">Scan source</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`${source.enabled ? "Disable" : "Enable"} ${source.name}`}
          accessibilityRole="button"
          className="min-w-40 grow border border-accent p-4 disabled:opacity-50"
          disabled={busy}
          onPress={() => void updateSource({ enabled: !source.enabled })}
        >
          <Text className="text-base text-ink-light dark:text-ink-dark">
            {source.enabled ? "Disable" : "Enable"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Edit destination for ${source.name}`}
          accessibilityRole="button"
          className="min-w-40 grow border border-accent p-4 disabled:opacity-50"
          disabled={busy}
          onPress={() => setEditingDestination(true)}
        >
          <Text className="text-base text-ink-light dark:text-ink-dark">Destination</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Reset upload history for ${source.name}`}
          accessibilityRole="button"
          className="min-w-40 grow border border-accent p-4 disabled:opacity-50"
          disabled={busy}
          onPress={resetHistory}
        >
          <Text className="text-base text-ink-light dark:text-ink-dark">Reset history</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel={`Remove ${source.name}`}
        accessibilityRole="button"
        className="p-4 disabled:opacity-50"
        disabled={busy}
        onPress={remove}
      >
        <Text className="text-base text-red-700 dark:text-red-300">Remove source</Text>
      </Pressable>
    </View>
  );
}
