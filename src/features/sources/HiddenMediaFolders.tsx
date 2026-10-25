import { useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, IconAction, Panel } from "@/components/ui";
import { hiddenMediaFolderLabel } from "./media-folder-suggestions";

export function HiddenMediaFolders({ folders, onRestore, onRestoreAll }: {
  folders: string[];
  onRestore: (id: string) => void;
  onRestoreAll: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!folders.length) return null;

  return (
    <View className="gap-2">
      <ActionButton icon={expanded ? "chevron-up" : "eye-off-outline"}
        label={`Hidden folders (${folders.length})`} accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)} />
      {expanded ? (
        <Panel>
          {folders.map((id) => {
            const label = hiddenMediaFolderLabel(id);
            return (
              <View key={id} className="flex-row items-center gap-2">
                <Text className="min-w-0 flex-1 text-base text-ink-light dark:text-ink-dark">{label}</Text>
                <IconAction icon="eye-outline" label={`Restore ${label}`} onPress={() => onRestore(id)} />
              </View>
            );
          })}
          <ActionButton icon="eye-outline" label="Restore all hidden folders" onPress={onRestoreAll} />
        </Panel>
      ) : null}
    </View>
  );
}
