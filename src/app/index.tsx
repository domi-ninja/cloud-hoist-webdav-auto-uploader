import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { project } from "@/config/project";
import webDavUploadEngine from "../../modules/webdav-upload-engine";
import { AccountConnection } from "@/features/account/AccountConnection";
import { SourceCard } from "@/features/sources/SourceCard";
import { SourceEditor } from "@/features/sources/SourceEditor";
import {
  existingPresetSource,
  selectionForPickerMode,
  type SourcePickerMode,
} from "@/features/sources/source-editor-state";
import { useEngineSnapshot } from "@/lib/engine-query";
import { useNow } from "@/lib/use-now";
import {
  ActionButton,
  ErrorNotice,
  IconAction,
  LoadingState,
  Panel,
} from "@/components/ui";
import { UploadProgress } from "@/components/UploadProgress";

export default function HomeScreen() {
  const router = useRouter();
  const { data: snapshot, error: snapshotError, refetch } = useEngineSnapshot();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [editingSourceId, setEditingSourceId] = useState<string | "new">();
  const [pickerMode, setPickerMode] = useState<SourcePickerMode>("all");
  const [scanning, setScanning] = useState(false);
  const [pausing, setPausing] = useState(false);
  const now = useNow();
  const uploadsPaused = snapshot?.engine.state === "paused";
  const uploadsStopped = snapshot?.worker.state === "stopped";
  const shouldStartUploads = uploadsPaused || uploadsStopped;

  const togglePaused = async () => {
    if (!snapshot) {
      return;
    }

    setPausing(true);
    setErrorMessage(undefined);
    try {
      const result =
        shouldStartUploads
          ? await webDavUploadEngine.resume()
          : await webDavUploadEngine.pause();

      if (!result.ok) {
        setErrorMessage(result.error.message);
      }
      await refetch();
    } catch {
      setErrorMessage("Could not change backup state. Please try again.");
    } finally {
      setPausing(false);
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
    } catch {
      setErrorMessage("Could not scan backup folders. Please try again.");
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
    const presetSelection = selectionForPickerMode(mode);
    const existing =
      snapshot && presetSelection
        ? existingPresetSource(snapshot.sources, presetSelection)
        : undefined;
    setPickerMode(mode);
    setEditingSourceId(existing?.id ?? "new");
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-canvas-light dark:bg-canvas-dark"
    >
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
              <Text
                accessibilityRole="header"
                className="shrink text-base font-semibold text-ink-light dark:text-ink-dark"
              >
                {project.displayName}
              </Text>
              {connected ? (
                <AccountConnection account={snapshot.account} />
              ) : null}
            </View>
            {snapshot ? (
              <Panel>
                <UploadProgress snapshot={snapshot} now={now} />
                {connected && visibleSources.length ? (
                  <View className="flex-row flex-wrap items-center gap-2">
                    <IconAction
                      icon="folder-search-outline"
                      disabled={scanning}
                      loading={scanning}
                      label={scanning ? "Scanning…" : "Scan now"}
                      onPress={() => void scanNow()}
                      tone="primary"
                    />
                    <ActionButton
                      icon={shouldStartUploads ? "play" : "pause"}
                      disabled={pausing}
                      loading={pausing}
                      label={
                        uploadsPaused
                          ? "Resume uploads"
                          : uploadsStopped
                            ? "Start uploads"
                            : "Pause uploads"
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
              <LoadingState label="Loading backups…" />
            )}
            {errorMessage || snapshotError ? (
              <ErrorNotice
                message={errorMessage ?? "Backups could not be loaded."}
                onRetry={() => void refetch()}
              />
            ) : null}
            {snapshot && snapshot.account.status !== "connected" ? (
              <AccountConnection account={snapshot.account} />
            ) : null}
            {connected ? (
              <View className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="text-base font-semibold text-ink-light dark:text-ink-dark"
                >
                  Backup folders
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {!existingPresetSource(visibleSources, { type: "camera" }) ? (
                    <ActionButton
                      icon="camera-outline"
                      label="Backup camera"
                      onPress={() => addSource("camera")}
                    />
                  ) : null}
                  {!existingPresetSource(visibleSources, { type: "screenshots" }) ? (
                    <ActionButton
                      icon="cellphone-screenshot"
                      label="Backup screenshots"
                      onPress={() => addSource("screenshots")}
                    />
                  ) : null}
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
