import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import webDavUploadEngine, {
  type EngineError,
  type SourcePreview,
  type SourceSelection,
} from "../../../modules/webdav-upload-engine";
import { LocalSourcePicker } from "./LocalSourcePicker";
import { RemoteFolderPicker } from "./RemoteFolderPicker";
import { ActionButton, Panel, Separator } from "@/components/ui";

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

function ChoiceMark({ selected }: { selected: boolean }) {
  return (
    <View className="h-6 w-6 items-center justify-center rounded-full border border-muted-light dark:border-muted-dark">
      {selected ? <View className="h-3 w-3 rounded-full bg-accent" /> : null}
    </View>
  );
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
      <View className="gap-4">
        <LocalSourcePicker
          onSelect={(nextSelection, nextPreview) => {
            setSelection(nextSelection);
            setPreview(nextPreview);
            setName(selectionName(nextSelection));
          }}
        />
        {onCancel ? (
          <ActionButton
            label="Cancel"
            onPress={onCancel}
          />
        ) : null}
      </View>
    );
  }

  if (!remotePath) {
    return (
      <View className="gap-4">
        <RemoteFolderPicker onSelect={setRemotePath} />
        <ActionButton
          label="Back"
          onPress={() => {
            setSelection(undefined);
            setPreview(undefined);
          }}
        />
        {onCancel ? (
          <ActionButton
            label="Cancel"
            onPress={onCancel}
          />
        ) : null}
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
    await webDavUploadEngine.requestNotificationPermission();
    onComplete();
  };

  return (
    <Panel>
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
      <Text className="text-base text-muted-light dark:text-muted-dark">
        Android will ask to show transfer progress while uploads run in the background.
      </Text>
      <View className="gap-4">
        <Pressable
          accessibilityLabel="Upload new files only"
          accessibilityRole="radio"
          accessibilityState={{ checked: !includeExisting }}
          className="flex-row items-center gap-4 p-4"
          onPress={() => setIncludeExisting(false)}
        >
          <ChoiceMark selected={!includeExisting} />
          <Text className="text-base text-ink-light dark:text-ink-dark">
            New files only (recommended)
          </Text>
        </Pressable>
        <Separator />
        <Pressable
          accessibilityLabel="Upload existing files too"
          accessibilityRole="radio"
          accessibilityState={{ checked: includeExisting }}
          className="flex-row items-center gap-4 p-4"
          onPress={() => setIncludeExisting(true)}
        >
          <ChoiceMark selected={includeExisting} />
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
      <ActionButton
        accessibilityLabel="Save upload source"
        disabled={busy || !name.trim()}
        label={busy ? "Saving…" : "Start auto upload"}
        onPress={() => void save()}
        tone="primary"
      />
      <ActionButton
        accessibilityLabel="Back to remote destination"
        disabled={busy}
        label="Back"
        onPress={() => setRemotePath(undefined)}
      />
      {onCancel ? (
        <ActionButton
          disabled={busy}
          label="Cancel"
          onPress={onCancel}
        />
      ) : null}
    </Panel>
  );
}
