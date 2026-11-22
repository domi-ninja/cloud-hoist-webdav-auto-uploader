import { useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, IconAction, Panel } from "@/components/ui";
import type { MediaFolder, SourceSummary } from "../../../modules/webdav-upload-engine";
import { HiddenFolderEditor } from "./HiddenFolderEditor";
import { hiddenMediaFolderLabel, storageTreeLocation } from "./media-folder-suggestions";

export function HiddenMediaFolders({ folders, mediaFolders, sources, previewStatus, onSave, onRestore, onRestoreAll }: {
  folders: string[];
  mediaFolders: MediaFolder[];
  sources: SourceSummary[];
  previewStatus?: string;
  onSave: (previous: string | null, uri: string) => Promise<void>;
  onRestore: (id: string) => void;
  onRestoreAll: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>();
  const custom = folders.filter((id) => storageTreeLocation(id));
  const specific = folders.filter((id) => !storageTreeLocation(id));

  return (
    <View className="gap-2">
      <ActionButton icon={expanded ? "chevron-up" : "eye-off-outline"}
        label={`Hidden folders (${folders.length})`} accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)} />
      {expanded ? (
        <Panel>
          <ActionButton icon="folder-hidden" label="Hide folder" onPress={() => setEditing(null)} />
          {[...custom, ...specific].map((id) => {
            const label = hiddenMediaFolderLabel(id);
            return (
              <View key={id} className="flex-row items-center gap-2">
                <Text className="min-w-0 flex-1 text-base text-ink-light dark:text-ink-dark">{label}</Text>
                {storageTreeLocation(id) && <IconAction icon="pencil-outline" label={`Edit ${label}`} onPress={() => setEditing(id)} />}
                <IconAction icon="eye-outline" label={`Restore ${label}`} onPress={() => onRestore(id)} />
              </View>
            );
          })}
          {folders.length > 0 && <ActionButton icon="eye-outline" label="Restore all hidden folders" onPress={onRestoreAll} />}
        </Panel>
      ) : null}
      {editing !== undefined && <HiddenFolderEditor original={editing} folders={mediaFolders}
        sources={sources} previewStatus={previewStatus} onClose={() => setEditing(undefined)} onSave={onSave} />}
    </View>
  );
}
