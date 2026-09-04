import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type RemoteFolder,
} from "../../../modules/webdav-upload-engine";

type RemoteFolderPickerProps = {
  onSelect: (pathSegments: string[]) => void;
};

function displayPath(pathSegments: string[]) {
  return pathSegments.length ? `/${pathSegments.join("/")}` : "/";
}

export function RemoteFolderPicker({ onSelect }: RemoteFolderPickerProps) {
  const [pathSegments, setPathSegments] = useState<string[]>([]);
  const [folders, setFolders] = useState<RemoteFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<EngineError>();

  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const result = await webDavUploadEngine.listRemoteFolders(pathSegments);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFolders(result.value);
  }, [pathSegments]);

  useEffect(() => {
    let active = true;
    void webDavUploadEngine.listRemoteFolders(pathSegments).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFolders(result.value);
    });
    return () => {
      active = false;
    };
  }, [pathSegments]);

  const openPath = (nextPath: string[]) => {
    setLoading(true);
    setError(undefined);
    setPathSegments(nextPath);
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setError({ code: "dav_invalid_path", message: "Enter a folder name." });
      return;
    }
    setCreating(true);
    setError(undefined);
    const result = await webDavUploadEngine.createRemoteFolder(pathSegments, name);
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewFolderName("");
    await loadFolders();
  };

  return (
    <View className="gap-4 border border-accent p-4">
      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
        Choose upload destination
      </Text>
      <Text className="text-base text-muted-light dark:text-muted-dark">
        {displayPath(pathSegments)}
      </Text>

      {error ? (
        <View className="gap-4">
          <Text className="text-base text-red-700 dark:text-red-300">
            {error.message}
          </Text>
          <Pressable
            accessibilityLabel="Retry remote folders"
            accessibilityRole="button"
            className="border border-accent p-4"
            onPress={() => void loadFolders()}
          >
            <Text className="text-base text-ink-light dark:text-ink-dark">Retry</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <Text className="text-base text-muted-light dark:text-muted-dark">
          Loading folders…
        </Text>
      ) : (
        <View className="gap-4">
          {folders.length ? (
            folders.map((folder) => (
              <Pressable
                accessibilityLabel={`Open ${folder.name}`}
                accessibilityRole="button"
                className="border border-accent p-4"
                key={folder.pathSegments.join("\0")}
                onPress={() => openPath(folder.pathSegments)}
              >
                <Text className="text-base text-ink-light dark:text-ink-dark">
                  {folder.name}/
                </Text>
              </Pressable>
            ))
          ) : (
            <Text className="text-base text-muted-light dark:text-muted-dark">
              This folder is empty.
            </Text>
          )}
        </View>
      )}

      <TextInput
        accessibilityLabel="New remote folder name"
        className="border border-muted-light p-4 text-base text-ink-light dark:border-muted-dark dark:text-ink-dark"
        editable={!creating}
        onChangeText={setNewFolderName}
        onSubmitEditing={() => void createFolder()}
        placeholder="New folder"
        placeholderTextColor="#737373"
        returnKeyType="done"
        value={newFolderName}
      />
      <Pressable
        accessibilityLabel="Create remote folder"
        accessibilityRole="button"
        className="border border-accent p-4"
        disabled={creating}
        onPress={() => void createFolder()}
      >
        <Text className="text-base text-ink-light dark:text-ink-dark">
          {creating ? "Creating…" : "Create folder"}
        </Text>
      </Pressable>

      {pathSegments.length ? (
        <Pressable
          accessibilityLabel="Go to parent remote folder"
          accessibilityRole="button"
          className="p-4"
          onPress={() => openPath(pathSegments.slice(0, -1))}
        >
          <Text className="text-base text-accent">Back</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel="Use current remote folder"
        accessibilityRole="button"
        className="bg-accent p-4"
        onPress={() => onSelect(pathSegments)}
      >
        <Text className="text-base font-semibold text-canvas-dark">
          Use this folder
        </Text>
      </Pressable>
    </View>
  );
}
