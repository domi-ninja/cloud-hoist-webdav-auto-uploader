import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine from "../../modules/webdav-upload-engine";
import {
  useEngineSnapshot,
  useRecentActivity,
  useUnresolvedFailures,
} from "@/lib/engine-query";

function transferState(
  state:
    | { status: "queued" }
    | { status: "uploading"; bytesSent: number }
    | { status: "uploaded"; uploadedAt: string }
    | { status: "failed"; code: string; retryable: boolean },
) {
  switch (state.status) {
    case "queued":
      return "Queued";
    case "uploading":
      return `Uploading · ${state.bytesSent.toLocaleString()} bytes sent`;
    case "uploaded":
      return `Uploaded · ${new Date(state.uploadedAt).toLocaleString()}`;
    case "failed":
      return `${state.retryable ? "Waiting to retry" : "Blocked"} · ${state.code}`;
  }
}

export default function ActivityScreen() {
  const router = useRouter();
  const snapshot = useEngineSnapshot();
  const activity = useRecentActivity();
  const failures = useUnresolvedFailures();
  const [errorMessage, setErrorMessage] = useState<string>();

  const retryFailed = async () => {
    const result = await webDavUploadEngine.retryFailed();
    if (!result.ok) setErrorMessage(result.error.message);
  };

  const clearCompleted = () => {
    Alert.alert(
      "Clear completed history?",
      "Queued, uploading, and failed transfers will stay. Uploaded files are not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            void webDavUploadEngine.clearCompletedHistory().then((result) => {
              if (!result.ok) setErrorMessage(result.error.message);
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Activity
        </Text>
        {snapshot.isLoading || activity.isLoading || failures.isLoading ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Loading activity…
          </Text>
        ) : null}
        {snapshot.error || activity.error || failures.error || errorMessage ? (
          <Text className="text-base text-red-700 dark:text-red-300">
            {errorMessage ?? "Activity could not be loaded."}
          </Text>
        ) : null}
        {snapshot.data?.blockers.length ? (
          <View className="gap-4">
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Blockers
            </Text>
            {snapshot.data.blockers.map((blocker, index) => (
              <View className="gap-4 border border-accent p-4" key={`${blocker.kind}-${index}`}>
                <Text className="text-base text-ink-light dark:text-ink-dark">
                  {blocker.kind === "account"
                    ? blocker.message
                    : blocker.kind === "permission"
                      ? `${blocker.permission === "media" ? "Photo access" : "Folder access"} must be restored.`
                      : blocker.kind === "network"
                        ? "Waiting for an allowed network."
                        : blocker.kind === "storage"
                          ? "Not enough local storage."
                          : blocker.message}
                </Text>
                {blocker.kind === "account" || blocker.kind === "permission" ? (
                  <Pressable
                    accessibilityLabel="Repair blocker in Sources"
                    accessibilityRole="button"
                    className="border border-accent p-4"
                    onPress={() => router.navigate("/")}
                  >
                    <Text className="text-base text-ink-light dark:text-ink-dark">
                      Repair in Sources
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {failures.data?.length ? (
          <View className="gap-4">
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Needs attention
            </Text>
            {failures.data.map((failure) => (
              <View className="gap-4 border border-accent p-4" key={failure.id}>
                <Text className="text-base text-ink-light dark:text-ink-dark">
                  {failure.message}
                </Text>
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  {failure.retryable ? "Will retry" : "Action required"} · {failure.code}
                </Text>
              </View>
            ))}
            <Pressable
              accessibilityLabel="Retry failed uploads"
              accessibilityRole="button"
              className="border border-accent p-4"
              onPress={() => void retryFailed()}
            >
              <Text className="text-base text-ink-light dark:text-ink-dark">
                Retry failed
              </Text>
            </Pressable>
          </View>
        ) : null}
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Transfers
        </Text>
        {snapshot.data?.recentJobs.length ? (
          snapshot.data.recentJobs.map((job) => (
            <View
              className="gap-4 border border-muted-light p-4 dark:border-muted-dark"
              key={job.id}
            >
              <Text className="text-base text-ink-light dark:text-ink-dark">
                {job.fileName}
              </Text>
              <Text className="text-base text-muted-light dark:text-muted-dark">
                {transferState(job.state)} · {job.byteCount.toLocaleString()} bytes
              </Text>
            </View>
          ))
        ) : !snapshot.isLoading ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            No queued transfers.
          </Text>
        ) : null}
        {snapshot.data?.queue.uploaded ? (
          <Pressable
            accessibilityLabel="Clear completed upload history"
            accessibilityRole="button"
            className="p-4"
            onPress={clearCompleted}
          >
            <Text className="text-base text-red-700 dark:text-red-300">
              Clear completed history
            </Text>
          </Pressable>
        ) : null}
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Recent
        </Text>
        {activity.data?.length ? (
          activity.data.map((entry) => (
            <View className="gap-4 border border-muted-light p-4 dark:border-muted-dark" key={entry.id}>
              <Text className="text-base text-ink-light dark:text-ink-dark">
                {entry.message}
              </Text>
              <Text className="text-base text-muted-light dark:text-muted-dark">
                {new Date(entry.occurredAt).toLocaleString()}
              </Text>
            </View>
          ))
        ) : !activity.isLoading ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            No uploads yet.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
