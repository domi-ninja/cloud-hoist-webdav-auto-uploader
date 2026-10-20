import { useState } from "react";
import { usePathname, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { project } from "@/config/project";
import webDavUploadEngine from "../../modules/webdav-upload-engine";
import { AccountConnection } from "@/features/account/AccountConnection";
import { MediaFolderSuggestion } from "@/features/sources/MediaFolderSuggestion";
import { mediaFolderId, mediaFolderSuggestions } from "@/features/sources/media-folder-suggestions";
import { useAppPreferences } from "@/lib/app-preferences";
import type { MediaFolder, SourceSelection } from "../../modules/webdav-upload-engine";
import { SourceEditor } from "@/features/sources/SourceEditor";
import {
    type SourcePickerMode,
} from "@/features/sources/source-editor-state";
import { useEngineSnapshot, useMediaFolders } from "@/lib/engine-query";
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
  const focused = usePathname() === "/";
  const { hiddenMediaFolders, setHiddenMediaFolders } = useAppPreferences();
  const [initialSelection, setInitialSelection] = useState<SourceSelection>();
  const [selectingFolder, setSelectingFolder] = useState(false);
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
      await Promise.all([scanNow(), media.refetch()]);
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
  const media = useMediaFolders(connected && focused);
  const suggestions = mediaFolderSuggestions(media.data?.folders ?? [], visibleSources, hiddenMediaFolders);
  const editingSource =
    editingSourceId && editingSourceId !== "new"
      ? snapshot?.sources.find((source) => source.id === editingSourceId)
      : undefined;
  const startSuggestion = (folder: MediaFolder) => {
    setInitialSelection({ type: "media_folder", volumeName: folder.volumeName, relativePath: folder.relativePath });
    setPickerMode("media");
    setEditingSourceId("new");
  };
  const chooseFolder = async () => {
    setSelectingFolder(true);
    setErrorMessage(undefined);
    try {
      const result = await webDavUploadEngine.pickDocumentTree();
      if (!result.ok) { setErrorMessage(result.error.message); return; }
      if (!result.value) return;
      setInitialSelection({ type: "document_tree", treeUri: result.value.treeUri });
      setPickerMode("folder");
      setEditingSourceId("new");
    } catch { setErrorMessage("Could not open the folder picker. Try again."); }
    finally { setSelectingFolder(false); }
  };
  const requestMediaAccess = async () => {
    const result = await webDavUploadEngine.requestMediaPermission();
    if (!result.ok) setErrorMessage(result.error.message);
    await media.refetch();
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-canvas-light dark:bg-canvas-dark"
    >
      <FlatList
        className="flex-1"
        contentContainerClassName="flex-grow p-2"
        data={suggestions}
        ItemSeparatorComponent={() => <View className="h-2" />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={mediaFolderId}
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
                        onPress={() => router.navigate("/status")}
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
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text accessibilityRole="header" className="text-base font-semibold text-ink-light dark:text-ink-dark">Suggested folders</Text>
                  {hiddenMediaFolders.length ? (
                    <IconAction icon="eye-outline" label="Show hidden suggestions" onPress={() => {
                      void setHiddenMediaFolders([]).catch(() => setErrorMessage("Could not restore hidden suggestions."));
                    }} />
                  ) : null}
                </View>
                <ActionButton icon="folder-outline" label="Backup other directory" disabled={selectingFolder}
                  loading={selectingFolder} onPress={() => void chooseFolder()} />
                {media.data?.permission.access === "denied" || media.data?.permission.access === "partial" ? (
                  <ActionButton icon="image-search-outline" label={media.data.permission.access === "denied" ? "Find media folders" : "Allow all media folders"}
                    onPress={() => void requestMediaAccess()} />
                ) : null}
                {media.isLoading ? <LoadingState label="Finding media folders…" /> : null}
                {media.error ? <ErrorNotice message="Media folders could not be loaded." onRetry={() => void media.refetch()} /> : null}
                {!media.isLoading && media.data?.permission.access !== "denied" && !suggestions.length ? (
                  <Text className="text-base text-muted-light dark:text-muted-dark">No more media folders to suggest.</Text>
                ) : null}
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
        renderItem={({ item: folder }) => (
          <MediaFolderSuggestion folder={folder} onStart={() => startSuggestion(folder)} onHide={() => {
            void setHiddenMediaFolders([...hiddenMediaFolders, mediaFolderId(folder)])
              .catch(() => setErrorMessage("Could not hide this suggestion."));
          }} />
        )}
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
          initialSelection={initialSelection}
          pickerMode={editingSourceId === "new" ? pickerMode : "all"}
          source={editingSource}
          sources={snapshot.sources}
          visible
        />
      ) : null}
    </SafeAreaView>
  );
}
