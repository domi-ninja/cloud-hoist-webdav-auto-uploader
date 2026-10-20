import { useState } from "react";
import { Text, View } from "react-native";
import { Menu } from "react-native-paper";
import type { MediaFolder } from "../../../modules/webdav-upload-engine";
import { ActionButton, IconAction, Panel } from "@/components/ui";
import { formatBytes } from "@/lib/format";

export function MediaFolderSuggestion({ folder, onStart, onHide }: {
  folder: MediaFolder;
  onStart: () => void;
  onHide: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const path = folder.relativePath.replace(/\/$/, "");
  return (
    <Panel>
      <View className="flex-row items-center gap-2">
        <Text className="min-w-0 flex-1 text-base font-semibold text-ink-light dark:text-ink-dark">{path}</Text>
        <Menu visible={menuOpen} onDismiss={() => setMenuOpen(false)} anchor={
          <IconAction icon="dots-vertical" label={`Suggestion actions for ${path}`} onPress={() => setMenuOpen(true)} />
        }>
          <Menu.Item title="Hide suggestion" leadingIcon="eye-off-outline" onPress={() => { setMenuOpen(false); onHide(); }} />
        </Menu>
      </View>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-base text-muted-light dark:text-muted-dark">{folder.fileCount} {folder.fileCount === 1 ? "file" : "files"} · {formatBytes(folder.totalBytes)}</Text>
        <ActionButton label="Start syncing" icon="cloud-upload-outline" onPress={onStart} />
      </View>
    </Panel>
  );
}
