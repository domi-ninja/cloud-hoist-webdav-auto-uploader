import { Fragment, useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { TextInput } from "react-native-paper";

import webDavUploadEngine, {
  type EngineError,
  type RemoteFolder,
} from "../../../modules/webdav-upload-engine";
import { ActionButton, IconAction, Panel, Separator } from "@/components/ui";

type RemoteFolderPickerProps = {
  initialPathSegments?: string[];
  onSelect: (pathSegments: string[]) => void;
  title?: string;
};

function displayPath(pathSegments: string[]) {
  return pathSegments.length ? `/${pathSegments.join("/")}` : "/";
}

export function RemoteFolderPicker({
  initialPathSegments = [],
  onSelect,
  title = "Choose upload destination",
}: RemoteFolderPickerProps) {
  const [pathSegments, setPathSegments] =
    useState<string[]>(initialPathSegments);
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
    const result = await webDavUploadEngine.createRemoteFolder(
      pathSegments,
      name,
    );
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
        {title}
      </Text>
      <Text className="text-base text-muted-light dark:text-muted-dark">
        {displayPath(pathSegments)}
      </Text>
      {pathSegments.length ? (
        <IconAction
          icon="arrow-up"
          label="Up one folder"
          onPress={() => openPath(pathSegments.slice(0, -1))}
        />
      ) : null}

      {error ? (
        <View className="gap-2">
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-red-700 dark:text-red-300"
          >
            {error.message}
          </Text>
          <IconAction
            icon="reload"
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
        <View className="gap-2">
          {folders.length ? (
            folders.map((folder, index) => (
              <Fragment key={folder.pathSegments.join("\0")}>
                {index ? <Separator /> : null}
                <ActionButton
                  accessibilityLabel={`Open ${folder.name}`}
                  disabled={creating}
                  icon="folder-outline"
                  label={folder.name}
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

      <View className="flex-row items-center gap-2">
        <TextInput
          accessibilityLabel="New remote folder name"
          dense
          editable={!creating}
          mode="outlined"
          onChangeText={setNewFolderName}
          onSubmitEditing={() => void createFolder()}
          placeholder="New folder"
          returnKeyType="done"
          style={{ flex: 1, fontSize: 16 }}
          value={newFolderName}
        />
        <IconAction
          icon="folder-plus-outline"
          disabled={creating}
          label={creating ? "Creating…" : "Create folder"}
          onPress={() => void createFolder()}
          tone="secondary"
        />
      </View>

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
