import { useMemo, useState } from "react";
import { Alert, Modal, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine, {
  type EngineError,
  type SourcePreview,
  type SourceSelection,
  type SourceSummary,
} from "../../../modules/webdav-upload-engine";
import { RadioButton, Switch } from "react-native-paper";
import { ActionButton, IconAction, Panel } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { ensureRemoteDestination } from "./default-destination";
import { LocalSourcePicker } from "./LocalSourcePicker";
import { RemoteFolderPicker } from "./RemoteFolderPicker";
import {
  existingPresetSource,
  sourceEditorInitialValue,
  sourceEditorValueKey,
  sourceInputFromEditor,
  sourceSelectionLabel,
} from "./source-editor-state";

type SourceEditorProps = {
  source?: SourceSummary;
  sources: SourceSummary[];
  visible: boolean;
  onClose: () => void;
  onEditExisting: (sourceId: string) => void;
  onSaved: () => void;
  pickerMode?: "all" | "folder" | "media" | "camera" | "screenshots";
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
  const initialValue = useMemo(
    () => sourceEditorInitialValue(source),
    [source],
  );
  const initialKey = sourceEditorValueKey(initialValue);
  const [name, setName] = useState(initialValue.name);
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
  const [choosingLocal, setChoosingLocal] = useState(!source);
  const [choosingRemote, setChoosingRemote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError>();

  const currentValue = {
    name,
    selection,
    remotePathSegments,
    enabled,
    collisionPolicy,
  };
  const dirty = sourceEditorValueKey(currentValue) !== initialKey;
  const canSave = Boolean(name.trim() && selection) && !busy;

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
            name,
            selection,
            remotePathSegments: destination.value,
            enabled,
            collisionPolicy,
          }),
        )
      : await webDavUploadEngine.commitSource({
          name,
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
      `Remove ${source.name}?`,
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
        <View className="flex-row items-center justify-between gap-4 p-4">
          <IconAction
            icon="close"
            disabled={busy}
            label="Cancel"
            onPress={close}
          />
          <Text className="shrink text-base font-semibold text-ink-light dark:text-ink-dark">
            {source ? "Edit source" : "Add source"}
          </Text>
          <IconAction
            icon="check"
            label={busy ? "Saving…" : "Save upload source"}
            disabled={!canSave}
            onPress={() => void save()}
          />
        </View>
        <ScrollView
          contentContainerClassName="gap-4 p-4"
          keyboardShouldPersistTaps="handled"
        >
          <Panel>
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Local folder
            </Text>
            <Text className="text-base text-muted-light dark:text-muted-dark">
              {sourceSelectionLabel(selection)}
            </Text>
            {preview ? (
              <Text className="text-base text-muted-light dark:text-muted-dark">
                {preview.eligibleFileCount} files ·{" "}
                {formatBytes(preview.totalBytes)}
              </Text>
            ) : null}
            <IconAction
              icon={choosingLocal ? "chevron-up" : "folder-edit-outline"}
              disabled={busy}
              label={choosingLocal ? "Hide choices" : "Change source"}
              onPress={() => setChoosingLocal((open) => !open)}
            />
          </Panel>
          {choosingLocal ? (
            <LocalSourcePicker
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
                if (!name.trim()) setName(sourceSelectionLabel(nextSelection));
                setChoosingLocal(false);
              }}
            />
          ) : null}
          <Panel>
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Source name
            </Text>
            <TextInput
              accessibilityLabel="Source name"
              className="border border-muted-light p-4 text-base text-ink-light dark:border-muted-dark dark:text-ink-dark"
              editable={!busy}
              onChangeText={setName}
              placeholder="Source name"
              placeholderTextColor="#737373"
              value={name}
            />
          </Panel>
          <Panel>
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Nextcloud folder
            </Text>
            <Text className="text-base text-muted-light dark:text-muted-dark">
              {displayPath(remotePathSegments)}
            </Text>
            <IconAction
              icon="folder-edit-outline"
              disabled={busy}
              label={
                choosingRemote ? "Hide folder browser" : "Change destination"
              }
              onPress={() => setChoosingRemote((open) => !open)}
            />
          </Panel>
          {choosingRemote ? (
            <RemoteFolderPicker
              onSelect={(pathSegments) => {
                setRemotePathSegments(pathSegments);
                setChoosingRemote(false);
              }}
            />
          ) : null}
          <Panel>
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              If a file already exists on Nextcloud
            </Text>
            <RadioButton.Item
              label="Replace on Nextcloud"
              value="replace"
              status={collisionPolicy === "replace" ? "checked" : "unchecked"}
              labelStyle={{ fontSize: 16 }}
              accessibilityLabel="Replace file on Nextcloud"
              disabled={busy}
              onPress={() => setCollisionPolicy("replace")}
            />
            <RadioButton.Item
              label="Keep both"
              value="keep_both"
              status={collisionPolicy === "keep_both" ? "checked" : "unchecked"}
              labelStyle={{ fontSize: 16 }}
              accessibilityLabel="Keep both files"
              disabled={busy}
              onPress={() => setCollisionPolicy("keep_both")}
            />
          </Panel>
          {source ? (
            <Panel>
              <View className="flex-row items-center justify-between gap-4">
                <View className="shrink gap-4">
                  <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                    Enabled
                  </Text>
                  <Text className="text-base text-muted-light dark:text-muted-dark">
                    Scan this folder and upload changes.
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
          <ActionButton
            icon="check"
            accessibilityLabel="Save upload source at bottom"
            disabled={!canSave}
            label={busy ? "Saving…" : "Save"}
            onPress={() => void save()}
            tone="primary"
          />
          {source ? (
            <Panel>
              <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                Source maintenance
              </Text>
              <View className="flex-row flex-wrap gap-4">
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
            </Panel>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
