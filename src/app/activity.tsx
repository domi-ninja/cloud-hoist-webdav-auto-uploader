import { Fragment, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
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
import { ActionButton, Panel, Separator } from "@/components/ui";

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
  const activeJobs =
    snapshot.data?.recentJobs.filter((job) => job.state.status !== "uploaded") ?? [];
  const activityItems = activity.data?.pages.flatMap((page) => page.items) ?? [];

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
            <Panel>
              {snapshot.data.blockers.map((blocker, index) => (
                <Fragment key={`${blocker.kind}-${index}`}>
                  {index ? <Separator /> : null}
                  <View className="gap-4">
                    <Text className="text-base text-ink-light dark:text-ink-dark">
                      {blockerText(blocker, now)}
                    </Text>
                    {blocker.kind === "account" || blocker.kind === "permission" ? (
                      <ActionButton
                        label="Repair in Sources"
                        onPress={() => router.navigate("/")}
                        tone="primary"
                      />
                    ) : null}
                  </View>
                </Fragment>
              ))}
            </Panel>
          </View>
        ) : null}
        {failures.data?.length ? (
          <View className="gap-4">
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Needs attention
            </Text>
            <Panel>
              {failures.data.map((failure, index) => (
                <Fragment key={failure.id}>
                  {index ? <Separator /> : null}
                  <View className="gap-4">
                    <Text className="text-base text-ink-light dark:text-ink-dark">
                      {failure.message}
                    </Text>
                    <Text className="text-base text-muted-light dark:text-muted-dark">
                      {failure.retryable ? "Will retry" : "Action required"} ·{" "}
                      {formatRelativeTime(failure.occurredAt, now)}
                    </Text>
                  </View>
                </Fragment>
              ))}
            </Panel>
            <ActionButton
              disabled={retrying}
              label={retrying ? "Retrying…" : "Retry failed"}
              onPress={() => void retryFailed()}
              tone="primary"
            />
          </View>
        ) : null}
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Transfers
        </Text>
        {activeJobs.length ? (
          <Panel>
            {activeJobs.map((job, index) => (
              <Fragment key={job.id}>
                {index ? <Separator /> : null}
                <View className="gap-4">
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
              </Fragment>
            ))}
          </Panel>
        ) : !snapshot.isLoading ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            No active transfers.
          </Text>
        ) : null}
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Recent activity
        </Text>
        {activityItems.length ? (
          <Panel>
            {activityItems.map((entry, index) => (
              <Fragment key={entry.id}>
                {index ? <Separator /> : null}
                <View className="gap-4">
                  <Text className="text-base text-ink-light dark:text-ink-dark">
                    {entry.message}
                  </Text>
                  <Text className="text-base text-muted-light dark:text-muted-dark">
                    {formatRelativeTime(entry.occurredAt, now)}
                  </Text>
                </View>
              </Fragment>
            ))}
          </Panel>
        ) : !activity.isLoading ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            No uploads yet.
          </Text>
        ) : null}
        {activity.hasNextPage ? (
          <ActionButton
            disabled={activity.isFetchingNextPage}
            label={activity.isFetchingNextPage ? "Loading…" : "Load older"}
            onPress={() => void activity.fetchNextPage()}
            tone="secondary"
          />
        ) : null}
        {snapshot.data?.queue.uploaded ? (
          <ActionButton
            accessibilityLabel="Clear completed upload history"
            disabled={clearing}
            label={clearing ? "Clearing…" : "Clear completed history"}
            onPress={clearCompleted}
            tone="danger"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
