import { useState } from "react";
import { Text, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type SourcePreview,
  type SourceSelection,
} from "../../../modules/webdav-upload-engine";
import { ActionButton, Panel, Separator } from "@/components/ui";

type LocalSourcePickerProps = {
  mode?: "all" | "folder" | "media" | "camera" | "screenshots";
  onSelect: (selection: SourceSelection, preview: SourcePreview) => void;
  embedded?: boolean;
};

type PendingMediaSelection = Extract<
  SourceSelection,
  { type: "camera" | "screenshots" }
>;

export function LocalSourcePicker({
  mode = "all",
  onSelect,
  embedded = false,
}: LocalSourcePickerProps) {
  const [pendingMedia, setPendingMedia] = useState<PendingMediaSelection>();
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
    setPreview(result.value);
    onSelect(nextSelection, result.value);
  };

  const chooseMedia = async (nextSelection: PendingMediaSelection) => {
    setPendingMedia(nextSelection);
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
      await loadPreview({
        type: "document_tree",
        treeUri: result.value.treeUri,
      });
    }
  };

  const content = (
    <>
      {!embedded ? (
        <Text className="text-base text-muted-light dark:text-muted-dark">
          Pick the photos or folder to back up.
        </Text>
      ) : null}

      {mode !== "folder" ? (
        <>
          <Separator />
          {mode !== "screenshots" ? (
            <ActionButton
              accessibilityLabel="Choose Camera source"
              disabled={busy}
              label="Camera"
              onPress={() => void chooseMedia({ type: "camera" })}
            />
          ) : null}
          {mode !== "camera" ? (
            <>
              <Separator />
              <ActionButton
                accessibilityLabel="Choose Screenshots source"
                disabled={busy}
                label="Screenshots"
                onPress={() => void chooseMedia({ type: "screenshots" })}
              />
            </>
          ) : null}
        </>
      ) : null}
      {mode !== "media" && mode !== "camera" && mode !== "screenshots" ? (
        <>
          <Separator />
          <ActionButton
            accessibilityLabel="Choose local folder source"
            disabled={busy}
            label="Choose folder"
            onPress={() => void chooseFolder()}
          />
        </>
      ) : null}

      {pendingMedia && !preview ? (
        <View className="gap-2">
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Allow access to the photos and videos you want watched. Limited
            access works, but only selected items can be discovered.
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
    </>
  );

  return embedded ? content : <Panel>{content}</Panel>;
}
