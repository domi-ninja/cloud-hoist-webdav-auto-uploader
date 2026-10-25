import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Keyboard,
  Text,
  View,
} from "react-native";
import { List } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine, {
  remotePathSegmentSchema,
  type RemoteFolder,
} from "../../../modules/webdav-upload-engine";
import {
  ActionButton,
  ErrorNotice,
  FormField,
  IconAction,
  LoadingState,
  Separator,
} from "@/components/ui";

import { parseRemoteFolderPath } from "./remote-folder-path";

type RemoteFolderPickerProps = {
  initialPathSegments?: string[];
  rootPathSegments?: string[];
  onError?: (message: string) => void;
  onSelect: (pathSegments: string[]) => void;
  onClose: () => void;
  title?: string;
};

export function RemoteFolderPicker({
  initialPathSegments = [],
  rootPathSegments = [],
  onError,
  onSelect,
  onClose,
  title = "Choose upload destination",
}: RemoteFolderPickerProps) {
  const withinRoot = (path: string[]) => rootPathSegments.every((segment, index) => path[index] === segment);
  const [pathSegments, setPathSegments] = useState(withinRoot(initialPathSegments) ? initialPathSegments : rootPathSegments);
  const [pathDraft, setPathDraft] = useState<string>();
  const [pathError, setPathError] = useState<string>();
  const [folders, setFolders] = useState<RemoteFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const request = useRef(0);
  useEffect(function reportFolderError() {
    if (error) onError?.(error);
  }, [error, onError]);

  useEffect(function loadRemoteFolders() {
    const id = ++request.current;
    void webDavUploadEngine
      .listRemoteFolders(pathSegments)
      .then((result) => {
        if (request.current !== id) return;
        if (result.ok) setFolders(result.value);
        else {
          setError(result.error.message);
        }
      })
      .catch(() => {
        if (request.current === id)
          setError(
            "Folders could not be loaded. Check your connection and retry.",
          );
      })
      .finally(() => {
        if (request.current === id) setLoading(false);
      });
    return () => {
      request.current += 1;
    };
  }, [pathSegments, reload]);

  const refresh = () => {
    setLoading(true);
    setError(undefined);
    setReload((value) => value + 1);
  };
  const openPath = (path: string[]) => {
    if (!withinRoot(path)) { setError("Choose a folder inside the backup root."); return; }
    setPathDraft(undefined);
    setPathError(undefined);
    setAddingFolder(false);
    Keyboard.dismiss();
    setLoading(true);
    setError(undefined);
    setFolders([]);
    setPathSegments(path);
  };
  const goToPath = () => {
    if (pathDraft === undefined) return;
    const parsed = parseRemoteFolderPath(pathDraft, rootPathSegments);
    if (parsed.error) { setPathError(parsed.error); return; }
    openPath(parsed.segments);
  };
  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name || creating) return;
    if (!remotePathSegmentSchema.safeParse(name).success) {
      setError("Enter a folder name without slashes, or . or .. as the whole name.");
      return;
    }
    setCreating(true);
    setError(undefined);
    try {
      const result = await webDavUploadEngine.createRemoteFolder(
        pathSegments,
        name,
      );
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setNewFolderName("");
      setAddingFolder(false);
      refresh();
    } catch {
      setError("The folder could not be created. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!creating) onClose();
      }}
    >
      <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View className="flex-row items-center gap-2 p-2">
            <IconAction
              icon="close"
              label="Close folder browser"
              disabled={creating}
              onPress={onClose}
            />
            <Text
              accessibilityRole="header"
              className="flex-1 text-base font-semibold text-ink-light dark:text-ink-dark"
            >
              {title}
            </Text>
          </View>
          <View className="gap-2 px-2 pb-2">
            {pathDraft !== undefined ? (
              <View className="gap-2">
                <FormField label="Folder path" value={pathDraft} onChangeText={(value) => { setPathDraft(value); setPathError(undefined); }}
                  autoFocus autoCapitalize="none" autoCorrect={false} editable={!creating}
                  onSubmitEditing={goToPath} returnKeyType="go" />
                <View className="flex-row flex-wrap gap-2">
                  <ActionButton label="Go to folder" icon="arrow-right" onPress={goToPath} />
                  <ActionButton label="Cancel" onPress={() => { setPathDraft(undefined); setPathError(undefined); Keyboard.dismiss(); }} />
                </View>
                {pathError ? <ErrorNotice message={pathError} /> : null}
              </View>
            ) : (
              <>
                <View className="flex-row flex-wrap items-center">
                  <Pressable accessibilityRole="button" accessibilityLabel="Go to server root"
                    disabled={creating || rootPathSegments.length > 0} onPress={() => openPath([])}
                    style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}>
                    <Text className="text-base text-ink-light dark:text-ink-dark">/</Text>
                  </Pressable>
                  {pathSegments.map((segment, index) => (
                    <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Go to /${pathSegments.slice(0, index + 1).join("/")}`}
                      disabled={creating || index + 1 < rootPathSegments.length}
                      onPress={() => openPath(pathSegments.slice(0, index + 1))}
                      style={{ minHeight: 44, justifyContent: "center", maxWidth: "100%", paddingHorizontal: 4 }}>
                      <Text className="text-base text-ink-light dark:text-ink-dark">{segment}{index < pathSegments.length - 1 ? " /" : ""}</Text>
                    </Pressable>
                  ))}
                </View>
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <ActionButton icon="folder-upload-outline" label="Up one folder"
                    disabled={pathSegments.length <= rootPathSegments.length || creating}
                    onPress={() => openPath(pathSegments.slice(0, -1))} />
                  <ActionButton icon="pencil-outline" label="Edit path" disabled={creating}
                    onPress={() => { setAddingFolder(false); setPathDraft("/" + pathSegments.join("/")); }} />
                </View>
              </>
            )}
            {addingFolder ? (
              <View className="flex-row items-center gap-2">
                <FormField
                  label="New folder name"
                  autoFocus
                  autoCapitalize="none"
                  style={{ flex: 1 }}
                  editable={!creating}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  onSubmitEditing={() => void createFolder()}
                  returnKeyType="done"
                />
                <IconAction
                  icon="check"
                  label="Create folder"
                  loading={creating}
                  disabled={creating || !newFolderName.trim()}
                  onPress={() => void createFolder()}
                />
              </View>
            ) : null}
            {error ? <ErrorNotice message={error} onRetry={refresh} /> : null}
            <View className="flex-row flex-wrap items-center gap-2">
              <ActionButton icon="check" label="Use this folder" accessibilityLabel="Use current remote folder"
                tone="primary" disabled={creating || loading || Boolean(error) || pathDraft !== undefined}
                onPress={() => onSelect(pathSegments)} />
              <ActionButton icon="folder-plus-outline" label="New folder"
                accessibilityState={{ expanded: addingFolder }}
                disabled={loading || creating || pathDraft !== undefined}
                onPress={() => setAddingFolder(!addingFolder)} />
            </View>
          </View>
          <Separator />
          {loading ? (
            <View className="p-2">
              <LoadingState label="Loading folders…" />
            </View>
          ) : (
            <FlatList
              data={folders}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(folder) => folder.pathSegments.join("/")}
              initialNumToRender={12}
              windowSize={5}
              ItemSeparatorComponent={Separator}
              ListEmptyComponent={
                !error ? (
                  <Text className="p-2 text-base text-muted-light dark:text-muted-dark">
                    No subfolders. You can use this folder.
                  </Text>
                ) : null
              }
              renderItem={({ item }) => (
                <List.Item
                  title={item.name}
                  titleStyle={{ fontSize: 16 }}
                  titleNumberOfLines={3}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.name}`}
                  disabled={creating}
                  onPress={() => openPath(item.pathSegments)}
                  left={(props) => (
                    <List.Icon {...props} icon="folder-outline" />
                  )}
                  right={(props) => (
                    <List.Icon {...props} icon="chevron-right" />
                  )}
                />
              )}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
