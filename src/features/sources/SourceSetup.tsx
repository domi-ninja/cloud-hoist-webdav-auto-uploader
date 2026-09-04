import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type SourcePreview,
  type SourceSelection,
} from "../../../modules/webdav-upload-engine";
import { LocalSourcePicker } from "./LocalSourcePicker";
import { RemoteFolderPicker } from "./RemoteFolderPicker";

type SourceSetupProps = {
  onComplete: () => void;
  onCancel?: () => void;
};

function selectionName(selection: SourceSelection) {
  switch (selection.type) {
    case "camera":
      return "Camera";
    case "screenshots":
      return "Screenshots";
    case "document_tree":
      return "Folder";
  }
}

function displayPath(pathSegments: string[]) {
  return pathSegments.length ? `/${pathSegments.join("/")}` : "/";
}

export function SourceSetup({ onComplete, onCancel }: SourceSetupProps) {
  const [selection, setSelection] = useState<SourceSelection>();
  const [preview, setPreview] = useState<SourcePreview>();
  const [remotePath, setRemotePath] = useState<string[]>();
  const [name, setName] = useState("");
  const [includeExisting, setIncludeExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError>();

  if (!selection || !preview) {
    return (
      <LocalSourcePicker
        onSelect={(nextSelection, nextPreview) => {
          setSelection(nextSelection);
          setPreview(nextPreview);
          setName(selectionName(nextSelection));
        }}
      />
    );
  }

  if (!remotePath) {
    return (
      <View className="gap-4">
        <RemoteFolderPicker onSelect={setRemotePath} />
        <Pressable
          accessibilityLabel="Back to local source"
          accessibilityRole="button"
          className="p-4"
          onPress={() => {
            setSelection(undefined);
            setPreview(undefined);
          }}
        >
          <Text className="text-base text-accent">Back</Text>
        </Pressable>
      </View>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(undefined);
    const result = await webDavUploadEngine.commitSource({
      name,
      selection,
      remotePathSegments: remotePath,
      includeExisting,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onComplete();
  };

  return (
    <View className="gap-4 border border-accent p-4">
      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
        Review source
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
      <Text className="text-base text-muted-light dark:text-muted-dark">
        {selectionName(selection)} → {displayPath(remotePath)}
      </Text>
      <Text className="text-base text-muted-light dark:text-muted-dark">
        {preview.eligibleFileCount} existing files are eligible.
      </Text>
      <View className="gap-4">
        <Pressable
          accessibilityLabel="Upload new files only"
          accessibilityRole="radio"
          accessibilityState={{ checked: !includeExisting }}
          className={`border p-4 ${!includeExisting ? "border-accent" : "border-muted-light dark:border-muted-dark"}`}
          onPress={() => setIncludeExisting(false)}
        >
          <Text className="text-base text-ink-light dark:text-ink-dark">
            New files only (recommended)
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Upload existing files too"
          accessibilityRole="radio"
          accessibilityState={{ checked: includeExisting }}
          className={`border p-4 ${includeExisting ? "border-accent" : "border-muted-light dark:border-muted-dark"}`}
          onPress={() => setIncludeExisting(true)}
        >
          <Text className="text-base text-ink-light dark:text-ink-dark">
            Include existing files
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text className="text-base text-red-700 dark:text-red-300">
          {error.message}
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel="Save upload source"
        accessibilityRole="button"
        className="bg-accent p-4"
        disabled={busy || !name.trim()}
        onPress={() => void save()}
      >
        <Text className="text-base font-semibold text-canvas-dark">
          {busy ? "Saving…" : "Start auto upload"}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Back to remote destination"
        accessibilityRole="button"
        className="p-4"
        disabled={busy}
        onPress={() => setRemotePath(undefined)}
      >
        <Text className="text-base text-accent">Back</Text>
      </Pressable>
      {onCancel ? (
        <Pressable
          accessibilityLabel="Cancel source setup"
          accessibilityRole="button"
          className="p-4"
          disabled={busy}
          onPress={onCancel}
        >
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Cancel
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
