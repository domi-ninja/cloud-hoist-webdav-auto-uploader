import { useState } from "react";
import { Text, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type SourcePreview,
  type SourceSelection,
} from "../../../modules/webdav-upload-engine";
import { formatBytes } from "@/lib/format";
import { ActionButton, Panel, Separator } from "@/components/ui";

type LocalSourcePickerProps = {
  onSelect: (selection: SourceSelection, preview: SourcePreview) => void;
};

type PendingMediaSelection = Extract<
  SourceSelection,
  { type: "camera" | "screenshots" }
>;

function sourceLabel(selection: SourceSelection) {
  switch (selection.type) {
    case "camera":
      return "Camera";
    case "screenshots":
      return "Screenshots";
    case "document_tree":
      return "Selected folder";
  }
}

export function LocalSourcePicker({ onSelect }: LocalSourcePickerProps) {
  const [pendingMedia, setPendingMedia] = useState<PendingMediaSelection>();
  const [selection, setSelection] = useState<SourceSelection>();
  const [preview, setPreview] = useState<SourcePreview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError>();

  const loadPreview = async (nextSelection: SourceSelection) => {
    setBusy(true);
    setError(undefined);
    const result = await webDavUploadEngine.previewSource(nextSelection);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelection(nextSelection);
    setPreview(result.value);
  };

  const chooseMedia = async (nextSelection: PendingMediaSelection) => {
    setPendingMedia(nextSelection);
    setSelection(undefined);
    setPreview(undefined);
    setError(undefined);

    const permission = await webDavUploadEngine.getMediaPermission();
    if (!permission.ok) {
      setError(permission.error);
      return;
    }
    if (permission.value.access !== "denied") {
      await loadPreview(nextSelection);
    }
  };

  const allowMedia = async () => {
    if (!pendingMedia) return;
    setBusy(true);
    setError(undefined);
    const permission = await webDavUploadEngine.requestMediaPermission();
    if (!permission.ok) {
      setBusy(false);
      setError(permission.error);
      return;
    }
    if (permission.value.access === "denied") {
      setBusy(false);
      setError({
        code: "source_permission_revoked",
        message: permission.value.canAskAgain
          ? "Photo and video access was not granted."
          : "Allow photo and video access in Android Settings to continue.",
      });
      return;
    }
    setBusy(false);
    await loadPreview(pendingMedia);
  };

  const chooseFolder = async () => {
    setPendingMedia(undefined);
    setSelection(undefined);
    setPreview(undefined);
    setBusy(true);
    setError(undefined);
    const result = await webDavUploadEngine.pickDocumentTree();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.value) {
      await loadPreview({ type: "document_tree", treeUri: result.value.treeUri });
    }
  };

  return (
    <Panel>
      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
        Choose what to upload
      </Text>
      <Text className="text-base text-muted-light dark:text-muted-dark">
        Pick a media collection or any readable Android folder.
      </Text>

      <Separator />
      <ActionButton
        accessibilityLabel="Choose Camera source"
        disabled={busy}
        label="Camera"
        onPress={() => void chooseMedia({ type: "camera" })}
      />
      <Separator />
      <ActionButton
        accessibilityLabel="Choose Screenshots source"
        disabled={busy}
        label="Screenshots"
        onPress={() => void chooseMedia({ type: "screenshots" })}
      />
      <Separator />
      <ActionButton
        accessibilityLabel="Choose local folder source"
        disabled={busy}
        label="Choose folder"
        onPress={() => void chooseFolder()}
      />

      {pendingMedia && !preview ? (
        <View className="gap-4">
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Allow access to the photos and videos you want watched. Limited access
            works, but only selected items can be discovered.
          </Text>
          <ActionButton
            disabled={busy}
            label="Review access"
            onPress={() => void allowMedia()}
            tone="primary"
          />
        </View>
      ) : null}

      {busy ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-muted-light dark:text-muted-dark"
        >
          Checking files…
        </Text>
      ) : null}
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-red-700 dark:text-red-300"
        >
          {error.message}
        </Text>
      ) : null}
      {selection && preview ? (
        <View className="gap-4">
          <Text className="text-base text-ink-light dark:text-ink-dark">
            {sourceLabel(selection)} · {preview.eligibleFileCount} files ·{" "}
            {formatBytes(preview.totalBytes)}
          </Text>
          {preview.permissionAccess === "partial" ? (
            <Text className="text-base text-muted-light dark:text-muted-dark">
              Android granted limited access. Only the selected media will upload.
            </Text>
          ) : null}
          <ActionButton
            accessibilityLabel={`Use ${sourceLabel(selection)} source`}
            label="Continue"
            onPress={() => onSelect(selection, preview)}
            tone="primary"
          />
        </View>
      ) : null}
    </Panel>
  );
}
