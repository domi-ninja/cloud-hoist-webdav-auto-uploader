import { Fragment, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Image, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine, {
  type EngineSnapshot,
  type FileInventoryEntry,
} from "../../modules/webdav-upload-engine";
import {
  useEngineSnapshot,
  useFileInventoryPages,
  useRemoteThumbnail,
} from "@/lib/engine-query";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { ActionButton, Panel, Separator } from "@/components/ui";

function blockerText(blocker: EngineSnapshot["blockers"][number], now: number) {
  switch (blocker.kind) {
    case "account":
      return blocker.message;
    case "permission":
      return `${blocker.permission === "media" ? "Photo access" : "Folder access"} must be restored.`;
    case "network":
      return blocker.retryAt
        ? `Waiting for an allowed network. Retry ${formatRelativeTime(blocker.retryAt, now)}.`
        : "Waiting for an allowed network.";
    case "storage":
      return `Not enough local storage. ${formatBytes(blocker.requiredBytes)} required, ${formatBytes(blocker.availableBytes)} available.`;
    case "job":
      return blocker.message;
  }
}

const presenceText: Record<FileInventoryEntry["presence"], string> = {
  local_only: "On phone only",
  remote_only: "On Nextcloud only",
  both: "On phone and Nextcloud",
};

const presenceIcon: Record<FileInventoryEntry["presence"], string> = {
  local_only: "↑",
  remote_only: "↓",
  both: "✓",
};

function transferText(entry: FileInventoryEntry, now: number) {
  switch (entry.transfer?.status) {
    case "queued":
      return "Queued";
    case "uploading":
      return `Uploading · ${formatBytes(entry.transfer.bytesSent)} sent`;
    case "uploaded":
      return `Uploaded ${formatRelativeTime(entry.transfer.uploadedAt, now)}`;
    case "failed":
      return entry.transfer.retryable ? "Waiting to retry" : "Upload blocked";
    default:
      return null;
  }
}

function FileThumbnail({ entry }: { entry: FileInventoryEntry }) {
  const image = entry.mimeType?.startsWith("image/") ?? false;
  const remoteThumbnail = useRemoteThumbnail(
    entry.sourceId,
    entry.relativePath,
    entry.modifiedAt,
    image && !entry.localUri,
  );
  const uri = entry.localUri ?? remoteThumbnail.data ?? undefined;

  return (
    <View className="h-20 w-20 shrink-0 items-center justify-center bg-canvas-light dark:bg-canvas-dark">
      {image && uri ? (
        <Image
          accessibilityLabel={`Thumbnail for ${entry.fileName}`}
          className="h-20 w-20"
          resizeMode="cover"
          source={{ uri }}
        />
      ) : (
        <Text className="text-base text-muted-light dark:text-muted-dark">FILE</Text>
      )}
      <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center bg-panel-light dark:bg-panel-dark">
        <Text
          accessibilityLabel={presenceText[entry.presence]}
          className="text-base font-semibold text-accent"
        >
          {presenceIcon[entry.presence]}
        </Text>
      </View>
    </View>
  );
}

function FileRow({ entry, now }: { entry: FileInventoryEntry; now: number }) {
  const transfer = transferText(entry, now);
  return (
    <View className="flex-row gap-4">
      <FileThumbnail entry={entry} />
      <View className="shrink gap-4">
        <Text
          accessibilityLabel={entry.fileName}
          className="text-base font-semibold text-ink-light dark:text-ink-dark"
          numberOfLines={2}
        >
          {entry.fileName}
        </Text>
        <Text className="text-base text-muted-light dark:text-muted-dark">
          {presenceText[entry.presence]} · {entry.sourceName}
        </Text>
        {transfer ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            {transfer}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const router = useRouter();
  const snapshot = useEngineSnapshot();
  const inventory = useFileInventoryPages();
  const [expanded, setExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const now = useNow();
  const allItems = inventory.data?.pages.flatMap((page) => page.items) ?? [];
  const items = expanded ? allItems : allItems.slice(0, 20);
  const inventoryErrors = inventory.data?.pages[0]?.errors ?? [];
  const hasFailures = allItems.some((entry) => entry.transfer?.status === "failed");

  const retryFailed = async () => {
    setRetrying(true);
    setErrorMessage(undefined);
    const result = await webDavUploadEngine.retryFailed();
    if (!result.ok) setErrorMessage(result.error.message);
    setRetrying(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    setErrorMessage(undefined);
    const scan = await webDavUploadEngine.scanNow();
    if (!scan.ok) setErrorMessage(scan.error.message);
    await Promise.all([snapshot.refetch(), inventory.refetch()]);
    setRefreshing(false);
  };

  const clearCompleted = () => {
    Alert.alert(
      "Clear completed history?",
      "The file list stays. Only completed transfer records are removed.",
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
        {snapshot.isLoading || inventory.isLoading ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-muted-light dark:text-muted-dark"
          >
            Loading files…
          </Text>
        ) : null}
        {snapshot.error || inventory.error || errorMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-red-700 dark:text-red-300"
          >
            {errorMessage ?? "The file inventory could not be loaded."}
          </Text>
        ) : null}
        {snapshot.data?.blockers.length ? (
          <View className="gap-4">
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Needs attention
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
        {inventoryErrors.map((error) => (
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-red-700 dark:text-red-300"
            key={error.sourceId}
          >
            Nextcloud files for this source could not be loaded. Local files are still shown.
          </Text>
        ))}
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Files
        </Text>
        {items.length ? (
          <Panel>
            {items.map((entry, index) => (
              <Fragment key={entry.id}>
                {index ? <Separator /> : null}
                <FileRow entry={entry} now={now} />
              </Fragment>
            ))}
          </Panel>
        ) : !inventory.isLoading ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            No files found.
          </Text>
        ) : null}
        {!expanded && (allItems.length >= 20 || inventory.hasNextPage) ? (
          <ActionButton label="Show more" onPress={() => setExpanded(true)} />
        ) : null}
        {expanded && inventory.hasNextPage ? (
          <ActionButton
            disabled={inventory.isFetchingNextPage}
            label={inventory.isFetchingNextPage ? "Loading…" : "Show 20 more"}
            onPress={() => void inventory.fetchNextPage()}
          />
        ) : null}
        {expanded ? (
          <ActionButton label="Show fewer" onPress={() => setExpanded(false)} />
        ) : null}
        {hasFailures ? (
          <ActionButton
            disabled={retrying}
            label={retrying ? "Retrying…" : "Retry failed"}
            onPress={() => void retryFailed()}
            tone="primary"
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
