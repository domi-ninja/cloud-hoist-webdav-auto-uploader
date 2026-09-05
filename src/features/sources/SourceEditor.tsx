import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine, {
  type EngineError,
  type SourcePreview,
  type SourceSelection,
  type SourceSummary,
} from "../../../modules/webdav-upload-engine";
import { ActionButton, Panel } from "@/components/ui";
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
}: SourceEditorProps) {
  const initialValue = useMemo(() => sourceEditorInitialValue(source), [source]);
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
    Alert.alert("Discard source changes?", "Your unsaved changes will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onClose },
    ]);
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

  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
        <View className="flex-row items-center justify-between gap-4 p-4">
          <ActionButton disabled={busy} label="Cancel" onPress={close} />
          <Text className="shrink text-base font-semibold text-ink-light dark:text-ink-dark">
            {source ? "Edit source" : "Add source"}
          </Text>
          <Pressable
            accessibilityLabel="Save upload source"
            accessibilityRole="button"
            className="p-4 disabled:opacity-50"
            disabled={!canSave}
            onPress={() => void save()}
          >
            <Text className="text-base font-semibold text-accent">
              {busy ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerClassName="gap-4 p-4"
          keyboardShouldPersistTaps="handled"
        >
          <Panel>
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              If a file already exists on Nextcloud
            </Text>
            <Pressable
              accessibilityLabel="Replace file on Nextcloud"
              accessibilityRole="radio"
              accessibilityState={{ checked: collisionPolicy === "replace" }}
              className="flex-row items-center gap-4 p-4"
              disabled={busy}
              onPress={() => setCollisionPolicy("replace")}
            >
              <Text className="text-base text-ink-light dark:text-ink-dark">
                {collisionPolicy === "replace" ? "●" : "○"} Replace on Nextcloud
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Keep both files"
              accessibilityRole="radio"
              accessibilityState={{ checked: collisionPolicy === "keep_both" }}
              className="flex-row items-center gap-4 p-4"
              disabled={busy}
              onPress={() => setCollisionPolicy("keep_both")}
            >
              <Text className="text-base text-ink-light dark:text-ink-dark">
                {collisionPolicy === "keep_both" ? "●" : "○"} Keep both
              </Text>
            </Pressable>
          </Panel>
          <Panel>
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Local folder
            </Text>
            <Text className="text-base text-muted-light dark:text-muted-dark">
              {sourceSelectionLabel(selection)}
            </Text>
            {preview ? (
              <Text className="text-base text-muted-light dark:text-muted-dark">
                {preview.eligibleFileCount} files · {formatBytes(preview.totalBytes)}
              </Text>
            ) : null}
            <ActionButton
              disabled={busy}
              label={choosingLocal ? "Hide choices" : "Change source"}
              onPress={() => setChoosingLocal((open) => !open)}
            />
          </Panel>
          {choosingLocal ? (
            <LocalSourcePicker
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
            <ActionButton
              disabled={busy}
              label={choosingRemote ? "Hide folder browser" : "Change destination"}
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
                thumbColor="#f4f4f0"
                trackColor={{ false: "#62665d", true: "#4f7d45" }}
                value={enabled}
              />
            </View>
          </Panel>
          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-base text-red-700 dark:text-red-300"
            >
              {error.message}
            </Text>
          ) : null}
          <ActionButton
            accessibilityLabel="Save upload source at bottom"
            disabled={!canSave}
            label={busy ? "Saving…" : "Save"}
            onPress={() => void save()}
            tone="primary"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
