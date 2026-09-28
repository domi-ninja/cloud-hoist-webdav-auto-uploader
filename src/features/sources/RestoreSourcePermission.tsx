import { useState } from "react";
import { Linking, Text, View } from "react-native";

import { ActionButton, IconAction } from "@/components/ui";
import webDavUploadEngine, {
  type EngineSnapshot,
  type SourceSummary,
} from "../../../modules/webdav-upload-engine";

type PermissionBlocker = Extract<
  EngineSnapshot["blockers"][number],
  { kind: "permission" }
>;

export function RestoreSourcePermission({
  source,
  blocker,
}: {
  source: SourceSummary;
  blocker: PermissionBlocker;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const restore = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (blocker.permission === "media") {
        const result = await webDavUploadEngine.requestMediaPermission();
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        if (result.value.access === "denied") {
          if (!result.value.canAskAgain) await Linking.openSettings();
          setError(
            "Allow photo and video access in Android Settings to continue.",
          );
          return;
        }
      } else {
        const result = await webDavUploadEngine.pickDocumentTree(
          source.localUri,
        );
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        if (!result.value) return;
        const updated = await webDavUploadEngine.addOrUpdateSource({
          ...source,
          localUri: result.value.treeUri,
        });
        if (!updated.ok) {
          setError(updated.error.message);
          return;
        }
      }

      const scan = await webDavUploadEngine.scanSource(source.id);
      if (!scan.ok) setError(scan.error.message);
      else if (scan.value.blocker) {
        setError(
          "Access is still unavailable. Check the selected folder or Android permissions.",
        );
      }
    } catch {
      setError("Could not restore access. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-2">
      <IconAction
        icon="folder-key-outline"
        disabled={busy}
        label={busy ? "Restoring access…" : `Restore ${source.name} access`}
        onPress={() => void restore()}
        tone="primary"
      />
      {error ? (
        <>
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-red-700 dark:text-red-300"
          >
            {error}
          </Text>
          <ActionButton
            icon="cog-outline"
            label="Open Android settings"
            onPress={() => void Linking.openSettings()}
          />
        </>
      ) : null}
    </View>
  );
}
