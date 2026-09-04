import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine, {
  type EngineSnapshot,
} from "../../modules/webdav-upload-engine";
import {
  useEngineSnapshot,
  useActivityPages,
  useUnresolvedFailures,
} from "@/lib/engine-query";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";

function transferState(
  state:
    | { status: "queued" }
    | { status: "uploading"; bytesSent: number }
    | { status: "uploaded"; uploadedAt: string }
    | { status: "failed"; code: string; retryable: boolean },
  now: number,
) {
  switch (state.status) {
    case "queued":
      return "Queued";
    case "uploading":
      return `Uploading · ${formatBytes(state.bytesSent)} sent`;
    case "uploaded":
      return `Uploaded ${formatRelativeTime(state.uploadedAt, now)}`;
    case "failed":
      return `${state.retryable ? "Waiting to retry" : "Blocked"} · ${state.code}`;
  }
}

function blockerText(blocker: EngineSnapshot["blockers"][number], now: number) {
  switch (blocker.kind) {
    case "account":
      return blocker.message;
    case "permission":
      return `${blocker.permission === "media" ? "Photo access" : "Folder access"} must be restored.`;
    case "network":
      return blocker.retryAt
        ? `Waiting for an allowed network. Scheduled retry ${formatRelativeTime(blocker.retryAt, now)}.`
        : "Waiting for an allowed network.";
    case "storage":
      return `Not enough local storage. ${formatBytes(blocker.requiredBytes)} required, ${formatBytes(blocker.availableBytes)} available.`;
    case "job":
      return blocker.message;
  }
}

export default function ActivityScreen() {
  const router = useRouter();
  const snapshot = useEngineSnapshot();
  const activity = useActivityPages();
  const failures = useUnresolvedFailures();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const now = useNow();

  const retryFailed = async () => {
    setRetrying(true);
    setErrorMessage(undefined);
    try {
      const result = await webDavUploadEngine.retryFailed();
      if (!result.ok) setErrorMessage(result.error.message);
    } finally {
      setRetrying(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([snapshot.refetch(), activity.refetch(), failures.refetch()]);
    } finally {
      setRefreshing(false);
    }
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
            setClearing(true);
            setErrorMessage(undefined);
            void webDavUploadEngine
              .clearCompletedHistory()
              .then((result) => {
                if (!result.ok) setErrorMessage(result.error.message);
              })
              .finally(() => setClearing(false));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
      >
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Activity
        </Text>
        {snapshot.isLoading || activity.isLoading || failures.isLoading ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-muted-light dark:text-muted-dark"
          >
            Loading activity…
          </Text>
        ) : null}
        {snapshot.error || activity.error || failures.error || errorMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-red-700 dark:text-red-300"
          >
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
                  {blockerText(blocker, now)}
                </Text>
                {blocker.kind === "account" || blocker.kind === "permission" ? (
                  <Pressable
                    accessibilityLabel="Repair blocker in Sources"
                    accessibilityRole="button"
                    className="border border-accent p-4 disabled:opacity-50"
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
                  {failure.retryable ? "Will retry" : "Action required"} ·{" "}
                  {formatRelativeTime(failure.occurredAt, now)}
                </Text>
              </View>
            ))}
            <Pressable
              accessibilityLabel="Retry failed uploads"
              accessibilityRole="button"
              className="border border-accent p-4 disabled:opacity-50"
              disabled={retrying}
              onPress={() => void retryFailed()}
            >
              <Text className="text-base text-ink-light dark:text-ink-dark">
                {retrying ? "Retrying…" : "Retry failed"}
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
              <Text
                accessibilityLabel={job.fileName}
                className="text-base text-ink-light dark:text-ink-dark"
                numberOfLines={2}
              >
                {job.fileName}
              </Text>
              <Text className="text-base text-muted-light dark:text-muted-dark">
                {transferState(job.state, now)} · {formatBytes(job.byteCount)}
              </Text>
            </View>
          ))
        ) : !snapshot.isLoading ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            No transfers in the queue.
          </Text>
        ) : null}
        {snapshot.data?.queue.uploaded ? (
          <Pressable
            accessibilityLabel="Clear completed upload history"
            accessibilityRole="button"
            className="p-4 disabled:opacity-50"
            disabled={clearing}
            onPress={clearCompleted}
          >
            <Text className="text-base text-red-700 dark:text-red-300">
              {clearing ? "Clearing…" : "Clear completed history"}
            </Text>
          </Pressable>
        ) : null}
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Recent activity
        </Text>
        {activity.data?.pages.some((page) => page.items.length) ? (
          activity.data.pages.flatMap((page) => page.items).map((entry) => (
            <View
              className="gap-4 border border-muted-light p-4 dark:border-muted-dark"
              key={entry.id}
            >
              <Text className="text-base text-ink-light dark:text-ink-dark">
                {entry.message}
              </Text>
              <Text className="text-base text-muted-light dark:text-muted-dark">
                {formatRelativeTime(entry.occurredAt, now)}
              </Text>
            </View>
          ))
        ) : !activity.isLoading ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            No uploads yet.
          </Text>
        ) : null}
        {activity.hasNextPage ? (
          <Pressable
            accessibilityLabel="Load older upload activity"
            accessibilityRole="button"
            className="border border-accent p-4 disabled:opacity-50"
            disabled={activity.isFetchingNextPage}
            onPress={() => void activity.fetchNextPage()}
          >
            <Text className="text-base text-ink-light dark:text-ink-dark">
              {activity.isFetchingNextPage ? "Loading…" : "Load older"}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
