import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine, {
  type DestinationChangeRequest,
  type EngineError,
  type SourcePreview,
  type SourceSelection,
  type SourceSummary,
} from "../../../modules/webdav-upload-engine";
import { DestinationPath } from "./DestinationPath";
import { requestBackupNotifications } from "./backup-notifications";
import { ActionButton, IconAction, LoadingState, Panel } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { useAppPreferences } from "@/lib/app-preferences";
import {
  defaultRemotePath,
  ensureRemoteDestination,
} from "./default-destination";
import { LocalSourcePicker } from "./LocalSourcePicker";
import { DestinationChangeModal } from "./DestinationChangeModal";
import { RemoteFolderPicker } from "./RemoteFolderPicker";
import { SourcePreviewThumbnails } from "./SourcePreviewThumbnails";
import {
  existingPresetSource,
  sourceEditorInitialValue,
  sourceEditorValueKey,
  sourceInputFromEditor,
  sourceSelectionLabel,
  sourceSelectionPath,
  sourceFolderPathSegments,
  type SourcePickerMode,
} from "./source-editor-state";

type SourceEditorProps = {
  source?: SourceSummary;
  initialSelection?: SourceSelection;
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
  initialSelection,
  sources,
  visible,
  onClose,
  onEditExisting,
  onSaved,
  pickerMode = "all",
}: SourceEditorProps) {
  const { remoteRootPath } = useAppPreferences();
  const initialValue = useMemo(
    () => sourceEditorInitialValue(source, pickerMode, remoteRootPath, initialSelection),
    [pickerMode, remoteRootPath, source, initialSelection],
  );
  const initialKey = sourceEditorValueKey(initialValue);
  const [selection, setSelection] = useState<SourceSelection | undefined>(
    initialValue.selection,
  );
  const [remotePathSegments, setRemotePathSegments] = useState(
    initialValue.remotePathSegments,
  );
  const enabled = initialValue.enabled;
  const collisionPolicy = initialValue.collisionPolicy;
  const [preview, setPreview] = useState<SourcePreview>();
  const [previewLoading, setPreviewLoading] = useState(
    Boolean(initialValue.selection),
  );
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [selectingLocal, setSelectingLocal] = useState(false);
  const [choosingRemote, setChoosingRemote] = useState(false);
  const [confirmingDestination, setConfirmingDestination] = useState<DestinationChangeRequest>();
  const [destinationError, setDestinationError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError>();
  useEffect(() => {
    const initialSelection = selection;
    if (!initialSelection) return;
    let cancelled = false;

    const loadPreview = async () => {
      setPreviewLoading(true);
      setError(undefined);
      try {
        if (initialSelection.type !== "document_tree") {
          const currentPermission =
            await webDavUploadEngine.getMediaPermission();
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
      } catch {
        if (!cancelled)
          setError({
            code: "source_permission_revoked",
            message: "Could not read this folder. Check access and try again.",
          });
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [selection, previewAttempt]);

  const currentValue = {
    name: selection ? sourceSelectionLabel(selection) : "",
    selection,
    remotePathSegments,
    enabled,
    collisionPolicy,
  };
  const dirty = sourceEditorValueKey(currentValue) !== initialKey;
  const canSave =
    Boolean(selection && preview) && !busy && !previewLoading && !selectingLocal;

  const close = () => {
    if (busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert(
      "Discard backup changes?",
      "Your unsaved changes will be lost.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ],
    );
  };

  const save = async (destinationConfirmed = false) => {
    if (!selection || !canSave) return;
    if (source && source.remotePath !== `/${remotePathSegments.join("/")}` && !destinationConfirmed) {
      setConfirmingDestination({ sourceId: source.id, pathSegments: remotePathSegments, rootChange: false });
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const destination = await ensureRemoteDestination(
        remotePathSegments,
        webDavUploadEngine.createRemoteFolder,
      );
      if (!destination.ok) {
        setBusy(false);
        setDestinationError(destination.error.message);
        return;
      }

      if (!source && sources.length === 0) await requestBackupNotifications();

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
        setDestinationError(result.error.message);
        return;
      }

      setBusy(false);
      onSaved();
    } catch {
      setDestinationError("The backup folder could not be saved. Check the destination and try again.");
    } finally {
      setBusy(false);
    }
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
          <Text
            accessibilityRole="header"
            className="shrink text-base font-semibold text-ink-light dark:text-ink-dark"
          >
            {source ? "Edit backup folder" : "Add backup folder"}
          </Text>
          {selection ? (
            <IconAction
              icon="check"
              tone="primary"
              label={busy ? "Saving…" : "Save backup folder"}
              disabled={!canSave}
              loading={busy}
              onPress={() => void save()}
            />
          ) : (
            <View className="size-12" />
          )}
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
                    ? `Files in ${sourceFolderPathSegments(selection).at(-1)}`
                    : "Choose a folder."}
                </Text>
                {selection ? (
                  <Text
                    selectable
                    className="text-base text-muted-light dark:text-muted-dark"
                  >
                    {sourceSelectionPath(selection)}
                  </Text>
                ) : null}
                {preview && selection ? (
                  <>
                    <SourcePreviewThumbnails
                      key={JSON.stringify(selection)}
                      preview={preview}
                      selection={selection}
                    />
                    <Text className="text-base text-muted-light dark:text-muted-dark">
                      {preview.eligibleFileCount} files ·{" "}
                      {formatBytes(preview.totalBytes)}
                    </Text>
                    {preview.permissionAccess === "partial" ? (
                      <Text className="text-base text-muted-light dark:text-muted-dark">
                        Only media allowed by Android will be backed up.
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {previewLoading ? (
                  <LoadingState label="Checking files…" />
                ) : null}
                {!previewLoading && selection && !preview ? (
                  <ActionButton
                    icon="reload"
                    label="Retry preview"
                    onPress={() => setPreviewAttempt((value) => value + 1)}
                  />
                ) : null}
              </View>
            </View>
            <LocalSourcePicker
              disabled={busy || selectingLocal}
              onBusyChange={setSelectingLocal}
              onSelect={(nextSelection) => {
                const existing = !source
                  ? existingPresetSource(sources, nextSelection)
                  : undefined;
                if (existing) {
                  onEditExisting(existing.id);
                  return;
                }
                setSelection(nextSelection);
                setPreview(undefined);
                setPreviewLoading(true);
                const previousFolder = selection ? sourceFolderPathSegments(selection) : [];
                const followsLocalFolder = previousFolder.length > 0 &&
                  previousFolder.every((segment, index) =>
                    remotePathSegments[remotePathSegments.length - previousFolder.length + index] === segment,
                  );
                const parent = followsLocalFolder
                  ? remotePathSegments.slice(0, -previousFolder.length)
                  : remoteRootPath;
                setRemotePathSegments(defaultRemotePath(nextSelection, parent));
              }}
            />
          </Panel>
          {selection ? (
            <>
              <Panel>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                      Nextcloud folder
                    </Text>
                    <DestinationPath path={displayPath(remotePathSegments)} />
                  </View>
                  <IconAction
                    icon="folder-edit-outline"
                    disabled={busy}
                    label={
                      choosingRemote ? "Hide folder browser" : "Change destination"
                    }
                    accessibilityState={{ expanded: choosingRemote }}
                    onPress={() => setChoosingRemote((open) => !open)}
                  />
                </View>
              </Panel>
              {confirmingDestination ? (
                <DestinationChangeModal
                  request={confirmingDestination}
                  onClose={() => setConfirmingDestination(undefined)}
                  onCompleted={() => { setConfirmingDestination(undefined); void save(true); }}
                />
              ) : null}
              {choosingRemote ? (
                <RemoteFolderPicker
                  onClose={() => setChoosingRemote(false)}
                  title="Choose backup destination"
                  initialPathSegments={remotePathSegments}
                  rootPathSegments={remoteRootPath}
                  onError={setDestinationError}
                  onSelect={(pathSegments) => {
                    setRemotePathSegments(pathSegments);
                    setDestinationError(undefined);
                    setChoosingRemote(false);
                  }}
                />
              ) : null}
            </>
          ) : null}
          {destinationError ? <Text accessibilityLiveRegion="polite" className="text-base text-red-700 dark:text-red-300">{destinationError}</Text> : null}
          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-base text-red-700 dark:text-red-300"
            >
              {error.message}
            </Text>
          ) : null}
          {selection ? (
            <View className="flex-row justify-end">
              <ActionButton
                icon="check"
                label={busy ? "Saving…" : "Save backup folder"}
                tone="primary"
                disabled={!canSave}
                loading={busy}
                onPress={() => void save()}
              />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
