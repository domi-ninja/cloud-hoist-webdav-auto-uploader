import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Icon, Menu } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";

import webDavUploadEngine, { type MediaFolder, type SourceSelection } from "../../../modules/webdav-upload-engine";
import { ActionButton, IconAction, LoadingState, Panel } from "@/components/ui";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { SourcePreviewThumbnails } from "./SourcePreviewThumbnails";

export function MediaFolderSuggestion({ folder, onStart, onHide }: {
  folder: MediaFolder;
  onStart: () => void;
  onHide: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const now = useNow();
  const previewGesture = useMemo(() => Gesture.Native().disallowInterruption(true), []);
  const path = folder.relativePath.replace(/\/$/, "");
  const selection: SourceSelection = {
    type: "media_folder", volumeName: folder.volumeName, relativePath: folder.relativePath,
  };
  const preview = useQuery({
    queryKey: ["suggested-folder-preview", folder.volumeName, folder.relativePath, folder.fileCount, folder.totalBytes, folder.latestFileAt],
    queryFn: async () => {
      const result = await webDavUploadEngine.previewSource(selection);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    staleTime: 30_000,
  });

  const hideAction = () => <View className="w-24 items-center justify-center rounded-lg bg-panel-light dark:bg-panel-dark"><Icon source="eye-off-outline" size={24} /></View>;
  return (
    <Swipeable renderLeftActions={hideAction} renderRightActions={hideAction}
      leftThreshold={80} rightThreshold={80} overshootLeft={false} overshootRight={false}
      requireExternalGestureToFail={previewGesture} onSwipeableOpen={onHide}>
      <Pressable onLongPress={() => setMenuOpen(true)} delayLongPress={400} accessible={false}>
        <Panel>
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={2} accessibilityLabel={path} className="min-w-0 flex-1 text-base font-semibold text-ink-light dark:text-ink-dark">{path}</Text>
            <Menu visible={menuOpen} onDismiss={() => setMenuOpen(false)} anchor={
              <IconAction icon="dots-vertical" label={`Suggestion actions for ${path}`} onPress={() => setMenuOpen(true)} />
            }>
              <Menu.Item title="Hide suggestion" leadingIcon="eye-off-outline" onPress={() => { setMenuOpen(false); onHide(); }} />
            </Menu>
            <ActionButton label="Start backup" icon="cloud-upload-outline" onPress={onStart} />
          </View>
          {preview.data ? (
            <SourcePreviewThumbnails key={`${folder.fileCount}:${folder.totalBytes}:${folder.latestFileAt}`} preview={preview.data} selection={selection} rows={1} scrollGesture={previewGesture} onLongPress={() => setMenuOpen(true)} />
          ) : (
            <View style={{ height: 96, justifyContent: "center" }}>
              {preview.isError ? <ActionButton icon="reload" label="Retry preview" onPress={() => void preview.refetch()} /> : <LoadingState label="Loading preview…" />}
            </View>
          )}
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-base text-muted-light dark:text-muted-dark">{folder.fileCount} {folder.fileCount === 1 ? "file" : "files"} · {formatBytes(folder.totalBytes)}</Text>
            {folder.latestFileAt ? (
              <Text className="ml-auto shrink text-right text-base text-muted-light dark:text-muted-dark">Latest file {formatRelativeTime(folder.latestFileAt, now)}</Text>
            ) : null}
          </View>
        </Panel>
      </Pressable>
    </Swipeable>
  );
}
