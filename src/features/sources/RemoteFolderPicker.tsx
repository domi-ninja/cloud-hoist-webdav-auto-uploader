import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  View,
} from "react-native";
import { List } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine, {
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

type RemoteFolderPickerProps = {
  initialPathSegments?: string[];
  onSelect: (pathSegments: string[]) => void;
  onClose: () => void;
  title?: string;
};

export function RemoteFolderPicker({
  initialPathSegments = [],
  onSelect,
  onClose,
  title = "Choose upload destination",
}: RemoteFolderPickerProps) {
  const [pathSegments, setPathSegments] = useState(initialPathSegments);
  const [folders, setFolders] = useState<RemoteFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    void webDavUploadEngine
      .listRemoteFolders(pathSegments)
      .then((result) => {
        if (request.current !== id) return;
        if (result.ok) setFolders(result.value);
        else setError(result.error.message);
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
    setLoading(true);
    setError(undefined);
    setFolders([]);
    setPathSegments(path);
  };
  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name || creating) return;
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
            <IconAction
              icon="folder-plus-outline"
              label="New folder"
              accessibilityState={{ expanded: addingFolder }}
              disabled={loading || creating}
              onPress={() => setAddingFolder(!addingFolder)}
            />
          </View>
          <View className="gap-2 px-2 pb-2">
            <View className="flex-row items-center gap-2">
              <IconAction
                icon="arrow-up"
                label="Up one folder"
                disabled={!pathSegments.length || creating}
                onPress={() => openPath(pathSegments.slice(0, -1))}
              />
              <Text
                selectable
                className="flex-1 text-base text-ink-light dark:text-ink-dark"
              >
                /{pathSegments.join("/")}
              </Text>
            </View>
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
            <ActionButton
              icon="check"
              label="Use this folder"
              accessibilityLabel="Use current remote folder"
              tone="primary"
              disabled={creating || loading || Boolean(error)}
              onPress={() => onSelect(pathSegments)}
            />
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
