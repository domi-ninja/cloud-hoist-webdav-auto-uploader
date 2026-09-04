import { Fragment, useCallback, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type RemoteFolder,
} from "../../../modules/webdav-upload-engine";
import { ActionButton, Panel, Separator } from "@/components/ui";

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
    <Panel>
      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
        Choose upload destination
      </Text>
      <Text className="text-base text-muted-light dark:text-muted-dark">
        {displayPath(pathSegments)}
      </Text>
      {pathSegments.length ? (
        <ActionButton
          label="Up one folder"
          onPress={() => openPath(pathSegments.slice(0, -1))}
        />
      ) : null}

      {error ? (
        <View className="gap-4">
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-red-700 dark:text-red-300"
          >
            {error.message}
          </Text>
          <ActionButton
            disabled={loading}
            label="Retry"
            onPress={() => void loadFolders()}
            tone="primary"
          />
        </View>
      ) : loading ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-muted-light dark:text-muted-dark"
        >
          Loading folders…
        </Text>
      ) : (
        <View className="gap-4">
          {folders.length ? (
            folders.map((folder, index) => (
              <Fragment key={folder.pathSegments.join("\0")}>
                {index ? <Separator /> : null}
                <ActionButton
                  accessibilityLabel={`Open ${folder.name}`}
                  disabled={creating}
                  label={`${folder.name}/`}
                  onPress={() => openPath(folder.pathSegments)}
                />
              </Fragment>
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
      <ActionButton
        disabled={creating}
        label={creating ? "Creating…" : "Create folder"}
        onPress={() => void createFolder()}
        tone="secondary"
      />

      <ActionButton
        accessibilityLabel="Use current remote folder"
        disabled={creating || loading}
        label="Use this folder"
        onPress={() => onSelect(pathSegments)}
        tone="primary"
      />
    </Panel>
  );
}
