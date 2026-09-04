import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { project } from "@/config/project";
import webDavUploadEngine, {
  type EngineSnapshot,
} from "../../modules/webdav-upload-engine";
import { AccountConnection } from "@/features/account/AccountConnection";
import { SourceCard } from "@/features/sources/SourceCard";
import {
  SourceSetup,
  type SourceSetupMode,
} from "@/features/sources/SourceSetup";
import { useEngineSnapshot } from "@/lib/engine-query";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { ActionButton, Panel } from "@/components/ui";

function engineStatus(snapshot: EngineSnapshot, now: number) {
  if (snapshot.account.status !== "connected") return "Connect an account to begin";
  if (snapshot.worker.state === "scanning") return "Scanning for new files";
  if (snapshot.worker.state === "uploading") {
    return `Uploading ${formatBytes(snapshot.worker.bytesSent)} of ${formatBytes(snapshot.worker.totalBytes)}`;
  }
  if (snapshot.engine.state === "blocked") {
    const count = snapshot.engine.blockerCount;
    return `${count} ${count === 1 ? "issue needs" : "issues need"} attention`;
  }
  if (snapshot.engine.state === "paused") {
    return `Uploads paused ${formatRelativeTime(snapshot.engine.pausedAt, now)}`;
  }
  if (snapshot.scheduler.lastScanCompletedAt) {
    return `Last scan ${formatRelativeTime(snapshot.scheduler.lastScanCompletedAt, now)}`;
  }
  return "Ready to upload";
}

function queueSummary(snapshot: EngineSnapshot) {
  const states = [
    [snapshot.queue.queued, "queued"],
    [snapshot.queue.uploading, "uploading"],
    [snapshot.queue.failed, "blocked"],
    [snapshot.queue.uploaded, "uploaded"],
  ] as const;
  const active = states.filter(([count]) => count > 0);
  return active.length
    ? active.map(([count, label]) => `${count} ${label}`).join(" · ")
    : "No uploads yet";
}

export default function HomeScreen() {
  const { data: snapshot, error: snapshotError, refetch } = useEngineSnapshot();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [addingSource, setAddingSource] =
    useState<Exclude<SourceSetupMode, "all">>();
  const [scanning, setScanning] = useState(false);
  const now = useNow();

  const togglePaused = async () => {
    if (!snapshot) {
      return;
    }

    const result =
      snapshot.engine.state === "paused"
        ? await webDavUploadEngine.resume()
        : await webDavUploadEngine.pause();

    if (!result.ok) {
      setErrorMessage(result.error.message);
    }
  };

  const scanNow = async () => {
    setScanning(true);
    setErrorMessage(undefined);

    try {
      const result = await webDavUploadEngine.scanNow();
      if (!result.ok) {
        setErrorMessage(result.error.message);
      }
      await refetch();
    } finally {
      setScanning(false);
    }
  };

  const refresh = async () => {
    if (snapshot?.account.status === "connected") {
      await scanNow();
      return;
    }

    setScanning(true);
    try {
      await refetch();
    } finally {
      setScanning(false);
    }
  };

  const connected = snapshot?.account.status === "connected";
  const showingSetup =
    connected && (snapshot.sources.length === 0 || Boolean(addingSource));
  const visibleSources = connected && !showingSetup ? snapshot.sources : [];

  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <FlatList
        className="flex-1"
        contentContainerClassName="flex-grow p-4"
        data={visibleSources}
        ItemSeparatorComponent={() => <View className="h-4" />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(source) => source.id}
        ListHeaderComponent={
          <View className="mb-4 gap-4">
            <View className="flex-row items-center justify-between gap-4">
              <Text className="shrink text-base font-semibold text-ink-light dark:text-ink-dark">
                {project.displayName}
              </Text>
              {connected ? <AccountConnection account={snapshot.account} /> : null}
            </View>
            {snapshot ? (
              <Panel>
                <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                  {engineStatus(snapshot, now)}
                </Text>
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  {queueSummary(snapshot)}
                </Text>
              </Panel>
            ) : (
              <Text className="text-base text-muted-light dark:text-muted-dark">
                Loading…
              </Text>
            )}
            {errorMessage || snapshotError ? (
              <Text
                accessibilityLiveRegion="polite"
                className="text-base text-red-700 dark:text-red-300"
              >
                {errorMessage ?? "Native engine contract failed."}
              </Text>
            ) : null}
            {snapshot && snapshot.account.status !== "connected" ? (
              <AccountConnection account={snapshot.account} />
            ) : null}
            {showingSetup ? (
              <SourceSetup
                mode={addingSource ?? "all"}
                onCancel={
                  snapshot.sources.length
                    ? () => setAddingSource(undefined)
                    : undefined
                }
                onComplete={() => {
                  setAddingSource(undefined);
                  void refetch();
                }}
              />
            ) : null}
            {visibleSources.length ? (
              <View className="gap-4">
                <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                  Sources
                </Text>
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  {visibleSources.length}{" "}
                  {visibleSources.length === 1 ? "source" : "sources"} · Add as
                  many watch folders as needed
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          connected && !showingSetup ? (
            <View className="mt-4 gap-4">
              <ActionButton
                accessibilityLabel="Add watch folder"
                label="Add watch folder"
                onPress={() => setAddingSource("folder")}
              />
              <ActionButton
                accessibilityLabel="Add Camera or Screenshots source"
                label="Add Camera or Screenshots"
                onPress={() => setAddingSource("media")}
              />
              <ActionButton
                disabled={scanning}
                label={scanning ? "Scanning…" : "Scan now"}
                onPress={() => void scanNow()}
                tone="primary"
              />
              <ActionButton
                accessibilityLabel={
                  snapshot.engine.state === "paused"
                    ? "Resume uploads"
                    : "Pause uploads"
                }
                disabled={scanning}
                label={
                  snapshot.engine.state === "paused" ? "Resume uploads" : "Pause uploads"
                }
                onPress={() => void togglePaused()}
              />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={scanning} onRefresh={() => void refresh()} />
        }
        renderItem={({ item: source }) =>
          snapshot ? (
            <SourceCard now={now} snapshot={snapshot} source={source} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
