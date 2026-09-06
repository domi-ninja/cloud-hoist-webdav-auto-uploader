import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine, {
  type EngineError,
  type SourcePreview,
  type SourceSelection,
  type SourceSummary,
} from "../../../modules/webdav-upload-engine";
import { RadioButton, Switch } from "react-native-paper";
import { IconAction, Panel } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { useAppPreferences } from "@/lib/app-preferences";
import {
  defaultRemotePath,
  ensureRemoteDestination,
} from "./default-destination";
import { LocalSourcePicker } from "./LocalSourcePicker";
import { RemoteFolderPicker } from "./RemoteFolderPicker";
import { SourcePreviewThumbnails } from "./SourcePreviewThumbnails";
import {
  existingPresetSource,
  keepBothPreviewName,
  sourceEditorInitialValue,
  sourceEditorValueKey,
  sourceInputFromEditor,
  sourceSelectionLabel,
  type SourcePickerMode,
} from "./source-editor-state";

type SourceEditorProps = {
  source?: SourceSummary;
  sources: SourceSummary[];
  visible: boolean;
  onClose: () => void;
  onEditExisting: (sourceId: string) => void;
  onSaved: () => void;
  pickerMode?: SourcePickerMode;
};

function displayPath(pathSegments: string[]) {
  return pathSegments.length ? `/${pathSegments.join("/")}` : "/";
}

export function SourceEditor({
  source,
  sources,
  visible,
  onClose,
  onEditExisting,
  onSaved,
  pickerMode = "all",
}: SourceEditorProps) {
  const { remoteRootPath } = useAppPreferences();
  const initialValue = useMemo(
    () => sourceEditorInitialValue(source, pickerMode, remoteRootPath),
    [pickerMode, remoteRootPath, source],
  );
  const initialKey = sourceEditorValueKey(initialValue);
  const [selection, setSelection] = useState<SourceSelection | undefined>(
    initialValue.selection,
  );
  const [remotePathSegments, setRemotePathSegments] = useState(
    initialValue.remotePathSegments,
  );
  const [enabled, setEnabled] = useState(initialValue.enabled);
  const [collisionPolicy, setCollisionPolicy] = useState(
    initialValue.collisionPolicy,
  );
  const [preview, setPreview] = useState<SourcePreview>();
  const [choosingLocal, setChoosingLocal] = useState(!initialValue.selection);
  const [choosingRemote, setChoosingRemote] = useState(false);
  const [destinationCustomized, setDestinationCustomized] = useState(
    Boolean(source),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError>();
  useEffect(() => {
    const initialSelection = initialValue.selection;
    if (!initialSelection) return;
    let cancelled = false;

    const loadPreview = async () => {
      if (initialSelection.type !== "document_tree") {
        const currentPermission = await webDavUploadEngine.getMediaPermission();
        if (cancelled) return;
        if (!currentPermission.ok) {
          setError(currentPermission.error);
          return;
        }
        if (currentPermission.value.access === "denied") {
          const requestedPermission =
            await webDavUploadEngine.requestMediaPermission();
          if (cancelled) return;
          if (!requestedPermission.ok) {
            setError(requestedPermission.error);
            return;
          }
          if (requestedPermission.value.access === "denied") {
            setError({
              code: "source_permission_revoked",
              message: "Allow photo and video access to preview this backup.",
            });
            return;
          }
        }
      }

      const result = await webDavUploadEngine.previewSource(initialSelection);
      if (cancelled) return;
      if (result.ok) setPreview(result.value);
      else setError(result.error);
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [initialValue.selection]);

  const currentValue = {
    name: selection ? sourceSelectionLabel(selection) : "",
    selection,
    remotePathSegments,
    enabled,
    collisionPolicy,
  };
  const dirty = sourceEditorValueKey(currentValue) !== initialKey;
  const canSave = Boolean(selection) && !busy;
  const previewFileName = preview?.files[0]?.fileName ?? "example.txt";
  const keepBothPreview = `${previewFileName} -> ${keepBothPreviewName(previewFileName)}`;

  const close = () => {
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert(
      "Discard source changes?",
      "Your unsaved changes will be lost.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ],
    );
  };

  const save = async () => {
    if (!selection || !canSave) return;
    setBusy(true);
    setError(undefined);

    const destination = await ensureRemoteDestination(
      remotePathSegments,
      webDavUploadEngine.createRemoteFolder,
    );
    if (!destination.ok) {
      setBusy(false);
      setError(destination.error);
      return;
    }

    const result = source
      ? await webDavUploadEngine.addOrUpdateSource(
          sourceInputFromEditor(source.id, {
            name: sourceSelectionLabel(selection),
            selection,
            remotePathSegments: destination.value,
            enabled,
            collisionPolicy,
          }),
        )
      : await webDavUploadEngine.commitSource({
          name: sourceSelectionLabel(selection),
          selection,
          remotePathSegments: destination.value,
          collisionPolicy,
        });

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    if (!source) await webDavUploadEngine.requestNotificationPermission();
    setBusy(false);
    onSaved();
  };

  const resetHistory = () => {
    if (!source) return;
    Alert.alert(
      "Upload existing files again?",
      "The next scan will reconsider files from this source. Files already on the server may be overwritten.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset history",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            void webDavUploadEngine
              .resetSourceHistory(source.id)
              .then((result) => {
                setBusy(false);
                if (!result.ok) setError(result.error);
              });
          },
        },
      ],
    );
  };

  const remove = () => {
    if (!source) return;
    Alert.alert(
      `Remove ${sourceSelectionLabel(selection)}?`,
      "This stops watching the source. Files already uploaded to Nextcloud are not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            void webDavUploadEngine.removeSource(source.id).then((result) => {
              setBusy(false);
              if (!result.ok) setError(result.error);
              else onSaved();
            });
          },
        },
      ],
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
        <View className="flex-row items-center justify-between gap-2 p-2">
          <IconAction
            icon="close"
            disabled={busy}
            label="Cancel"
            onPress={close}
          />
          <Text className="shrink text-base font-semibold text-ink-light dark:text-ink-dark">
            {source ? "Edit backup folder" : "Add backup folder"}
          </Text>
          <IconAction
            icon="check"
            label={busy ? "Saving…" : "Save backup folder"}
            disabled={!canSave}
            onPress={() => void save()}
          />
        </View>
        <ScrollView
          contentContainerClassName="gap-2 p-2"
          keyboardShouldPersistTaps="handled"
        >
          <Panel>
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                  What do we back up?
                </Text>
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  {selection
                    ? `Upload photos in ${sourceSelectionLabel(selection)}.`
                    : "Choose a folder."}
                </Text>
                {preview ? (
                  <>
                    <SourcePreviewThumbnails files={preview.files} />
                    <Text className="text-base text-muted-light dark:text-muted-dark">
                      {preview.eligibleFileCount} files ·{" "}
                      {formatBytes(preview.totalBytes)}
                    </Text>
                    {preview.permissionAccess === "partial" ? (
                      <Text className="text-base text-muted-light dark:text-muted-dark">
                        Only photos allowed by Android will be backed up.
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
              <IconAction
                icon={choosingLocal ? "chevron-up" : "folder-edit-outline"}
                disabled={busy}
                label={choosingLocal ? "Hide choices" : "Change source"}
                onPress={() => setChoosingLocal((open) => !open)}
              />
            </View>
            {choosingLocal ? (
              <LocalSourcePicker
                embedded
                mode={pickerMode}
                onSelect={(nextSelection, nextPreview) => {
                  const existing = !source
                    ? existingPresetSource(sources, nextSelection)
                    : undefined;
                  if (existing) {
                    onEditExisting(existing.id);
                    return;
                  }
                  setSelection(nextSelection);
                  setPreview(nextPreview);
                  if (!destinationCustomized) {
                    setRemotePathSegments(
                      defaultRemotePath(nextSelection, remoteRootPath),
                    );
                  }
                  setChoosingLocal(false);
                }}
              />
            ) : null}
          </Panel>
          <Panel>
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                  Nextcloud folder
                </Text>
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  {displayPath(remotePathSegments)}
                </Text>
              </View>
              <IconAction
                icon="folder-edit-outline"
                disabled={busy}
                label={
                  choosingRemote ? "Hide folder browser" : "Change destination"
                }
                onPress={() => setChoosingRemote((open) => !open)}
              />
            </View>
          </Panel>
          {choosingRemote ? (
            <RemoteFolderPicker
              onSelect={(pathSegments) => {
                setRemotePathSegments(
                  selection
                    ? defaultRemotePath(selection, pathSegments)
                    : pathSegments,
                );
                setDestinationCustomized(true);
                setChoosingRemote(false);
              }}
            />
          ) : null}
          <Panel>
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              What to do with files that you change on the phone?
            </Text>
            <View>
              <RadioButton.Item
                label="Update files"
                value="replace"
                status={collisionPolicy === "replace" ? "checked" : "unchecked"}
                labelStyle={{ fontSize: 16 }}
                style={{
                  minHeight: 48,
                  paddingVertical: 0,
                  paddingHorizontal: 8,
                }}
                accessibilityLabel="Update files on Nextcloud"
                disabled={busy}
                onPress={() => setCollisionPolicy("replace")}
              />
              <RadioButton.Item
                label="Add a number to the name."
                value="keep_both"
                status={
                  collisionPolicy === "keep_both" ? "checked" : "unchecked"
                }
                labelStyle={{ fontSize: 16 }}
                style={{
                  minHeight: 48,
                  paddingVertical: 0,
                  paddingHorizontal: 8,
                }}
                accessibilityLabel={`Add a number to the name. Preview: ${keepBothPreview}`}
                disabled={busy}
                onPress={() => setCollisionPolicy("keep_both")}
              />
              <Text className="px-2 pb-2 text-sm text-muted-light dark:text-muted-dark">
                Preview: {keepBothPreview}
              </Text>
            </View>
          </Panel>
          {source ? (
            <Panel>
              <View className="flex-row items-center justify-between gap-2">
                <View className="shrink gap-2">
                  <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                    Enabled
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Enable upload source"
                  disabled={busy}
                  onValueChange={setEnabled}
                  value={enabled}
                />
              </View>
            </Panel>
          ) : null}
          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-base text-red-700 dark:text-red-300"
            >
              {error.message}
            </Text>
          ) : null}
          {source ? (
            <Panel>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="shrink text-base font-semibold text-ink-light dark:text-ink-dark">
                  Maintenance
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <IconAction
                    icon="history"
                    disabled={busy}
                    label="Reset upload history"
                    onPress={resetHistory}
                  />
                  <IconAction
                    icon="delete-outline"
                    disabled={busy}
                    label="Remove source"
                    onPress={remove}
                    tone="danger"
                  />
                </View>
              </View>
            </Panel>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
