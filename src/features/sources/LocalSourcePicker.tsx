import { useState } from "react";
import { Text, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type SourceSelection,
} from "../../../modules/webdav-upload-engine";
import { IconAction } from "@/components/ui";

type LocalSourcePickerProps = {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSelect: (selection: SourceSelection) => void;
};

export function LocalSourcePicker({
  disabled,
  onBusyChange,
  onSelect,
}: LocalSourcePickerProps) {
  const [error, setError] = useState<EngineError>();

  const chooseFolder = async () => {
    onBusyChange(true);
    setError(undefined);
    try {
      const result = await webDavUploadEngine.pickDocumentTree();
      if (!result.ok) setError(result.error);
      else if (result.value) {
        onSelect({ type: "document_tree", treeUri: result.value.treeUri });
      }
    } catch {
      setError({
        code: "native_failure",
        message: "Could not open the folder picker. Try again.",
      });
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        <IconAction
          icon="camera-outline"
          label="Choose Camera source"
          disabled={disabled}
          onPress={() => {
            setError(undefined);
            onSelect({ type: "camera" });
          }}
        />
        <IconAction
          icon="cellphone-screenshot"
          label="Choose Screenshots source"
          disabled={disabled}
          onPress={() => {
            setError(undefined);
            onSelect({ type: "screenshots" });
          }}
        />
        <IconAction
          icon="folder-open-outline"
          label="Choose local folder source"
          disabled={disabled}
          onPress={() => void chooseFolder()}
        />
      </View>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-red-700 dark:text-red-300"
        >
          {error.message}
        </Text>
      ) : null}
    </View>
  );
}
