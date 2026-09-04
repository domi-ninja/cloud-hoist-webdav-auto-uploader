import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, Text, View } from "react-native";

import { project } from "@/config/project";
import webDavUploadEngine, {
  type EngineSnapshot,
} from "../../modules/webdav-upload-engine";
import { AccountConnection } from "@/features/account/AccountConnection";

export default function HomeScreen() {
  const [snapshot, setSnapshot] = useState<EngineSnapshot>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await webDavUploadEngine.getSnapshot());
      setErrorMessage(undefined);
    } catch {
      setErrorMessage("Native engine contract failed.");
    }
  }, []);

  useEffect(() => {
    const subscription = webDavUploadEngine.addSnapshotInvalidatedListener(() => {
      void refresh();
    });
    // This starts an async native read; state changes only after the promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return () => subscription.remove();
  }, [refresh]);

  const togglePaused = async () => {
    if (!snapshot) {
      return;
    }

    const result =
      snapshot.engine.state === "paused"
        ? await webDavUploadEngine.resume()
        : await webDavUploadEngine.pause();

    if (!result.ok) {
      setErrorMessage(result.error.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-between gap-4 p-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4">
          <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
            {project.displayName}
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Automatic uploads for {project.supportedServer} are being built here.
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            {snapshot
              ? `Native engine: ${snapshot.engine.state} · revision ${snapshot.revision}`
              : "Loading native engine…"}
          </Text>
          {errorMessage ? (
            <Text className="text-base text-red-700 dark:text-red-300">
              {errorMessage}
            </Text>
          ) : null}
          {snapshot ? <AccountConnection account={snapshot.account} /> : null}
        </View>

        <Pressable
          accessibilityRole="button"
          className="border border-accent p-4"
          disabled={!snapshot}
          onPress={() => void togglePaused()}
        >
          <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
            {snapshot?.engine.state === "paused"
              ? "Resume fixture engine"
              : "Pause fixture engine"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
