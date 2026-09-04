import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, ScrollView, Text, View } from "react-native";

import { project } from "@/config/project";
import webDavUploadEngine from "../../modules/webdav-upload-engine";
import { AccountConnection } from "@/features/account/AccountConnection";
import { SourceCard } from "@/features/sources/SourceCard";
import { SourceSetup } from "@/features/sources/SourceSetup";
import { useEngineSnapshot } from "@/lib/engine-query";

export default function HomeScreen() {
  const { data: snapshot, error: snapshotError, refetch } = useEngineSnapshot();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [addingSource, setAddingSource] = useState(false);

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

  const scanNow = async () => {
    const result = await webDavUploadEngine.scanNow();
    if (!result.ok) setErrorMessage(result.error.message);
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
            Automatic uploads for {project.supportedServer}.
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            {snapshot
              ? `Native engine: ${snapshot.engine.state} · revision ${snapshot.revision}`
              : "Loading native engine…"}
          </Text>
          {errorMessage || snapshotError ? (
            <Text className="text-base text-red-700 dark:text-red-300">
              {errorMessage ?? "Native engine contract failed."}
            </Text>
          ) : null}
          {snapshot ? <AccountConnection account={snapshot.account} /> : null}
          {snapshot?.account.status === "connected" &&
          (snapshot.sources.length === 0 || addingSource) ? (
            <SourceSetup
              onCancel={snapshot.sources.length ? () => setAddingSource(false) : undefined}
              onComplete={() => {
                setAddingSource(false);
                void refetch();
              }}
            />
          ) : null}
          {snapshot?.sources.length ? (
            <View className="gap-4">
              <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                Sources
              </Text>
              <Text className="text-base text-muted-light dark:text-muted-dark">
                {snapshot.queue.queued} queued · {snapshot.queue.uploading} uploading ·{" "}
                {snapshot.queue.failed} blocked · {snapshot.queue.uploaded} uploaded
              </Text>
              {snapshot.sources.map((source) => (
                <SourceCard key={source.id} snapshot={snapshot} source={source} />
              ))}
              {!addingSource ? (
                <Pressable
                  accessibilityLabel="Add upload source"
                  accessibilityRole="button"
                  className="border border-accent p-4"
                  onPress={() => setAddingSource(true)}
                >
                  <Text className="text-base text-ink-light dark:text-ink-dark">
                    Add source
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {snapshot?.account.status === "connected" ? (
          <View className="gap-4">
            <Pressable
              accessibilityRole="button"
              className="border border-accent p-4"
              onPress={() => void scanNow()}
            >
              <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                Scan now
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="border border-accent p-4"
              onPress={() => void togglePaused()}
            >
              <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                {snapshot.engine.state === "paused" ? "Resume uploads" : "Pause uploads"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
