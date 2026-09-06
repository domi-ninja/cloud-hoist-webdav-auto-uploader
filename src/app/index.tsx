import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { project } from "@/config/project";
import webDavUploadEngine from "../../modules/webdav-upload-engine";
import { AccountConnection } from "@/features/account/AccountConnection";
import { SourceCard } from "@/features/sources/SourceCard";
import { SourceEditor } from "@/features/sources/SourceEditor";
import { useEngineSnapshot } from "@/lib/engine-query";
import { useNow } from "@/lib/use-now";
import { ActionButton, IconAction, Panel } from "@/components/ui";
import { engineStatus, queueSummary } from "@/lib/upload-status";

export default function HomeScreen() {
  const router = useRouter();
  const { data: snapshot, error: snapshotError, refetch } = useEngineSnapshot();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [editingSourceId, setEditingSourceId] = useState<string | "new">();
  const [pickerMode, setPickerMode] = useState<
    "all" | "folder" | "camera" | "screenshots"
  >("all");
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
  const visibleSources = connected ? snapshot.sources : [];
  const editingSource =
    editingSourceId && editingSourceId !== "new"
      ? snapshot?.sources.find((source) => source.id === editingSourceId)
      : undefined;
  const addSource = (mode: typeof pickerMode = "all") => {
    setPickerMode(mode);
    setEditingSourceId("new");
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <FlatList
        className="flex-1"
        contentContainerClassName="flex-grow p-2"
        data={visibleSources}
        ItemSeparatorComponent={() => <View className="h-2" />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(source) => source.id}
        ListHeaderComponent={
          <View className="mb-2 gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="shrink text-base font-semibold text-ink-light dark:text-ink-dark">
                {project.displayName}
              </Text>
              {connected ? (
                <AccountConnection account={snapshot.account} />
              ) : null}
            </View>
            {snapshot ? (
              <Panel>
                <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                  {engineStatus(snapshot, now)}
                </Text>
                {Object.values(snapshot.queue).some((count) => count > 0) ? (
                  <Text className="text-base text-muted-light dark:text-muted-dark">
                    {queueSummary(snapshot)}
                  </Text>
                ) : null}
                {connected && visibleSources.length ? (
                  <View className="flex-row flex-wrap items-center gap-2">
                    <IconAction
                      icon="folder-search-outline"
                      disabled={scanning}
                      label={scanning ? "Scanning…" : "Scan now"}
                      onPress={() => void scanNow()}
                      tone="primary"
                    />
                    <IconAction
                      icon={
                        snapshot.engine.state === "paused" ? "play" : "pause"
                      }
                      disabled={scanning}
                      label={
                        snapshot.engine.state === "paused" ? "Resume" : "Pause"
                      }
                      onPress={() => void togglePaused()}
                    />
                    {snapshot.blockers.length ? (
                      <ActionButton
                        label={`${snapshot.blockers.length} ${snapshot.blockers.length === 1 ? "issue" : "issues"}`}
                        onPress={() => router.navigate("/activity")}
                        tone="danger"
                      />
                    ) : null}
                  </View>
                ) : null}
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
            {connected ? (
              <View className="gap-2">
                <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                  Backup folders
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <ActionButton
                    icon="camera-outline"
                    label="Backup camera"
                    onPress={() => addSource("camera")}
                  />
                  <ActionButton
                    icon="cellphone-screenshot"
                    label="Backup screenshots"
                    onPress={() => addSource("screenshots")}
                  />
                  <ActionButton
                    icon="folder-outline"
                    label="Backup other directory"
                    onPress={() => addSource("folder")}
                  />
                </View>
              </View>
            ) : null}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={scanning}
            onRefresh={() => void refresh()}
          />
        }
        renderItem={({ item: source }) =>
          snapshot ? (
            <SourceCard
              now={now}
              onEdit={() => setEditingSourceId(source.id)}
              snapshot={snapshot}
              source={source}
            />
          ) : null
        }
      />
      {connected && editingSourceId ? (
        <SourceEditor
          key={editingSourceId}
          onClose={() => setEditingSourceId(undefined)}
          onEditExisting={setEditingSourceId}
          onSaved={() => {
            setEditingSourceId(undefined);
            void refetch();
          }}
          pickerMode={editingSourceId === "new" ? pickerMode : "all"}
          source={editingSource}
          sources={snapshot.sources}
          visible
        />
      ) : null}
    </SafeAreaView>
  );
}
