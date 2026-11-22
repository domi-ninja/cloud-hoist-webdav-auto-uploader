import { useState } from "react";
import { FlatList, Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import engine, { type MediaFolder, type SourceSummary } from "../../../modules/webdav-upload-engine";
import { ActionButton, ErrorNotice, IconAction } from "@/components/ui";
import { hiddenMediaFolderLabel, mediaFolderId, sourceCoversMediaFolder, storageTreeLocation, treeCoversFolder } from "./media-folder-suggestions";

export function HiddenFolderEditor({ original, folders, sources, previewStatus, onSave, onClose }: {
  original: string | null;
  folders: MediaFolder[];
  sources: SourceSummary[];
  previewStatus?: string;
  onSave: (original: string | null, uri: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const tree = selected && storageTreeLocation(selected);
  const matches = tree ? folders.filter((folder) => treeCoversFolder(tree, folder) &&
    !sources.some((source) => sourceCoversMediaFolder(source, folder))) : [];

  async function choose() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await engine.pickDocumentTree(selected, false);
      if (!result.ok) setError(result.error.message);
      else if (result.value) {
        if (storageTreeLocation(result.value.treeUri)) setSelected(result.value.treeUri);
        else setError("Choose a folder on internal storage or an SD card.");
      }
    } catch {
      setError("Could not open the folder picker.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      await onSave(original, selected);
      onClose();
    } catch {
      setError("Could not save the hidden folder.");
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <SafeAreaView className="flex-1 gap-2 bg-canvas-light p-2 dark:bg-canvas-dark">
        <View className="flex-row items-center gap-2">
          <IconAction icon="arrow-left" label="Cancel" disabled={busy} onPress={onClose} />
          <Text accessibilityRole="header" className="flex-1 text-base font-semibold text-ink-light dark:text-ink-dark">
            {original ? "Edit hidden folder" : "Hide folder"}
          </Text>
          <ActionButton label="Save" disabled={busy || !selected} onPress={() => void save()} />
        </View>
        {selected && <Text className="text-base text-ink-light dark:text-ink-dark">{hiddenMediaFolderLabel(selected)}</Text>}
        <ActionButton icon="folder-open-outline" label={selected ? "Change folder" : "Choose folder"} disabled={busy} onPress={() => void choose()} />
        {error && <ErrorNotice message={error} />}
        {tree && <>
          <Text accessibilityRole="header" className="text-base font-semibold text-ink-light dark:text-ink-dark">Matching media folders ({matches.length})</Text>
          {previewStatus && <Text className="text-base text-muted-light dark:text-muted-dark">{previewStatus}</Text>}
          <FlatList data={matches} keyExtractor={mediaFolderId}
            ListEmptyComponent={previewStatus ? null : <Text className="text-base text-muted-light dark:text-muted-dark">No matching media folders detected.</Text>}
            renderItem={({ item }) => <Text className="py-2 text-base text-ink-light dark:text-ink-dark">{item.relativePath.replace(/\/$/, "")}</Text>} />
        </>}
      </SafeAreaView>
    </Modal>
  );
}
