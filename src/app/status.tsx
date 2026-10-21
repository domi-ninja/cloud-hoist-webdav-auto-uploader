import { Fragment, memo, useMemo, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Icon, SegmentedButtons } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine, {
  type FileInventoryEntry,
  type FileInventoryFilter,
} from "../../modules/webdav-upload-engine";
import {
  useEngineSnapshot,
  useFileInventoryPages,
  useRemoteThumbnail,
  useUnresolvedFailures,
} from "@/lib/engine-query";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import {
  ActionButton,
  IconAction,
  LoadingState,
  Panel,
  Separator,
} from "@/components/ui";
import { MediaThumbnail } from "@/components/MediaThumbnail";
import { SourceCard } from "@/features/sources/SourceCard";
import { SourceEditor } from "@/features/sources/SourceEditor";
import { RestoreSourcePermission } from "@/features/sources/RestoreSourcePermission";
import { attentionBlockers } from "@/lib/upload-status";
import { UploadControls } from "@/components/UploadControls";
import { ScreenHeader } from "@/components/ScreenHeader";

function blockerText(blocker: ReturnType<typeof attentionBlockers>[number]) {
  switch (blocker.kind) {
    case "account":
      return blocker.message;
    case "permission":
      return `${blocker.permission === "media" ? "Photo access" : "Folder access"} must be restored.`;
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
  local_only: "upload",
  remote_only: "cloud-check-outline",
  both: "check",
};

function transferText(entry: FileInventoryEntry, now: number) {
  switch (entry.transfer?.status) {
    case "queued":
      return "Queued";
    case "uploading":
      return entry.transfer.bytesSent > 0
        ? `Uploading · ${formatBytes(entry.transfer.bytesSent)} sent`
        : "Uploading";
    case "uploaded":
      return `Uploaded ${formatRelativeTime(entry.transfer.uploadedAt, now)}`;
    case "failed":
      return entry.transfer.retryable ? "Waiting to retry" : "Upload blocked";
    default:
      return null;
  }
}

function FileThumbnail({ entry }: { entry: FileInventoryEntry }) {
  const media = entry.mimeType?.startsWith("image/") || entry.mimeType?.startsWith("video/");
  const remoteThumbnail = useRemoteThumbnail(
    entry.sourceId,
    entry.relativePath,
    entry.modifiedAt,
    Boolean(media && !entry.localUri),
  );
  const uri = entry.localUri ?? remoteThumbnail.data ?? undefined;

  return (
    <View className="h-20 w-20 shrink-0 items-center justify-center bg-canvas-light dark:bg-canvas-dark">
      <MediaThumbnail uri={uri} mimeType={!entry.localUri && remoteThumbnail.data ? "image/jpeg" : entry.mimeType} size={80} version={entry.modifiedAt} />
      {presenceIcon[entry.presence] ? (
        <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center bg-panel-light dark:bg-panel-dark">
          <Icon
            source={presenceIcon[entry.presence] ?? "file-outline"}
            size={24}
          />
        </View>
      ) : null}
    </View>
  );
}

const FileRow = memo(function FileRow({
  entry,
  now,
}: {
  entry: FileInventoryEntry;
  now: number;
}) {
  const transfer = transferText(entry, now);
  const router = useRouter();
  return (
    <Pressable
      onPress={entry.jobId ? () => router.push({ pathname: "/upload-failure", params: { jobId: entry.jobId! } }) : undefined}
      accessibilityRole={entry.jobId ? "button" : undefined}
      accessible
      accessibilityLabel={`${entry.fileName}. ${presenceText[entry.presence]}. ${entry.sourceName}. ${transfer ?? ""}`}
      className="flex-row gap-2 rounded-lg bg-panel-light p-2 dark:bg-panel-dark"
    >
      <FileThumbnail entry={entry} />
      <View className="flex-1 gap-2">
        <Text
          accessibilityLabel={entry.fileName}
          className="text-base font-semibold text-ink-light dark:text-ink-dark"
          numberOfLines={2}
        >
          {entry.fileName}
        </Text>
        {transfer ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            {transfer}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

export default function StatusScreen() {
  const router = useRouter();
  const [editingSourceId, setEditingSourceId] = useState<string>();
  const focused = usePathname() === "/status";
  const snapshot = useEngineSnapshot();
  const failures = useUnresolvedFailures(focused);
  const [statusFilter, setStatusFilter] =
    useState<FileInventoryFilter["status"]>("all");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = statusFilter !== "all" || sourceFilter !== null;
  const activeSourceFilter = snapshot.data?.sources.some(
    (source) => source.id === sourceFilter,
  )
    ? sourceFilter
    : null;
  const inventory = useFileInventoryPages(
    {
      sourceId: activeSourceFilter,
      status: statusFilter,
    },
    focused && snapshot.data?.account.status === "connected",
  );
  const [errorMessage, setErrorMessage] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const now = useNow();
  const allItems = useMemo(
    () => inventory.data?.pages.flatMap((page) => page.items) ?? [],
    [inventory.data],
  );
  const inventoryErrors = inventory.data?.pages[0]?.errors ?? [];
  const blockers = attentionBlockers(snapshot.data?.blockers ?? []);
  const actionableFailures = failures.data?.filter((failure) => !failure.retryable);
  const hasFailures = Boolean(actionableFailures?.length);
  const failureDetails = actionableFailures?.filter(
    (failure) =>
      !snapshot.data?.blockers.some(
        (blocker) => blocker.kind === "job" && blocker.jobId === failure.jobId,
      ),
  );

  const retryFailed = async () => {
    setRetrying(true);
    setErrorMessage(undefined);
    try {
      const result = await webDavUploadEngine.retryFailed();
      if (!result.ok) setErrorMessage(result.error.message);
      await Promise.all([
        failures.refetch(),
        snapshot.refetch(),
        inventory.refetch(),
      ]);
    } catch {
      setErrorMessage("Could not retry uploads. Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setErrorMessage(undefined);
    try {
      if (snapshot.data?.account.status === "connected") {
        const scan = await webDavUploadEngine.scanNow();
        if (!scan.ok) setErrorMessage(scan.error.message);
      }
      await Promise.all([
        snapshot.refetch(),
        ...(snapshot.data?.account.status === "connected"
          ? [inventory.refetch()]
          : []),
        failures.refetch(),
      ]);
    } catch {
      setErrorMessage("Could not refresh files. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-canvas-light dark:bg-canvas-dark"
    >
      <FlatList
        className="flex-1"
        contentContainerClassName="gap-2 p-2"
        data={allItems}
        keyExtractor={(entry) => entry.id}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        renderItem={({ item }) => <FileRow entry={item} now={now} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />
        }
        ListHeaderComponent={
          <View className="gap-2">
            <ScreenHeader title="Status" account={snapshot.data?.account} />
            {snapshot.data ? <UploadControls snapshot={snapshot.data} now={now} onError={setErrorMessage} onScanned={() => inventory.refetch()} /> : null}
            {snapshot.data?.sources.map((source) => (
              <SourceCard key={source.id} source={source} snapshot={snapshot.data!}
                now={now} onEdit={() => setEditingSourceId(source.id)} />
            ))}
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
            {blockers.length || hasFailures ? (
              <View className="gap-2">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                    Needs attention
                  </Text>
                  {hasFailures ? (
                    <IconAction
                      icon="reload"
                      disabled={retrying}
                      label={retrying ? "Retrying…" : "Retry failed"}
                      onPress={() => void retryFailed()}
                      tone="primary"
                    />
                  ) : null}
                </View>
                <Panel>
                  {blockers.map((blocker, index) => {
                    const source =
                      blocker.kind === "permission"
                        ? snapshot.data?.sources.find(
                            (item) => item.id === blocker.sourceId,
                          )
                        : undefined;
                    return (
                      <Fragment key={`${blocker.kind}-${index}`}>
                        {index ? <Separator /> : null}
                        <View className="gap-2">
                          <Text className="text-base text-ink-light dark:text-ink-dark">
                            {blockerText(blocker)}
                          </Text>
                          {blocker.kind === "account" ? (
                            <ActionButton
                              label="Open account settings"
                              onPress={() =>
                                router.navigate({
                                  pathname: "/settings",
                                  params: { account: "open" },
                                })
                              }
                              tone="primary"
                            />
                          ) : blocker.kind === "permission" && source ? (
                            <RestoreSourcePermission
                              blocker={blocker}
                              source={source}
                            />
                          ) : null}
                        </View>
                      </Fragment>
                    );
                  })}
                  {failureDetails?.slice(0, 10).map((failure, index) => (
                    <Fragment key={failure.id}>
                      {index || blockers.length ? (
                        <Separator />
                      ) : null}
                      <Text className="text-base text-ink-light dark:text-ink-dark">
                        {failure.message}
                      </Text>
                    </Fragment>
                  ))}
                  {failureDetails && failureDetails.length > 10 ? (
                    <Text className="text-base text-muted-light dark:text-muted-dark">
                      {failureDetails.length - 10} more failures. Use the Failed
                      filter to browse affected files.
                    </Text>
                  ) : null}
                </Panel>
              </View>
            ) : null}
            {inventoryErrors.map((error) => (
              <Text
                accessibilityLiveRegion="polite"
                className="text-base text-red-700 dark:text-red-300"
                key={error.sourceId}
              >
                Nextcloud files for{" "}
                {snapshot.data?.sources.find(
                  (source) => source.id === error.sourceId,
                )?.name ?? "this source"}{" "}
                could not be loaded. {error.message} Local files are still
                shown.
              </Text>
            ))}
            <View className="mt-2 gap-2">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                  Files
                </Text>
                <IconAction
                  icon={filtered ? "filter-check" : "filter-variant"}
                  label={
                    filtersOpen
                      ? "Hide file filters"
                      : filtered
                        ? "Show file filters, filters active"
                        : "Show file filters"
                  }
                  accessibilityState={{ expanded: filtersOpen }}
                  tone={filtered ? "secondary" : "quiet"}
                  onPress={() => setFiltersOpen(!filtersOpen)}
                />
              </View>
              {filtersOpen ? (
                <>
                  <SegmentedButtons
                    value={statusFilter}
                    onValueChange={(value) => {
                      if (value === "all" || value === "pending" || value === "failed" || value === "uploaded") setStatusFilter(value);
                    }}
                    density="small"
                    buttons={(["all", "pending", "failed", "uploaded"] as const).map((status) => ({
                      value: status,
                      label: status === "all" ? "All" : status[0].toUpperCase() + status.slice(1),
                      accessibilityLabel: `Filter files: ${status}`,
                      style: { paddingHorizontal: 0 },
                      labelStyle: { fontSize: 13, marginVertical: 4 },
                    }))}
                  />
                  {snapshot.data && snapshot.data.sources.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                      <ActionButton
                        accessibilityState={{ selected: sourceFilter === null }}
                        label="All folders"
                        compact contentStyle={{ minHeight: 36 }} labelStyle={{ fontSize: 13 }}
                        onPress={() => setSourceFilter(null)}
                        tone={sourceFilter === null ? "secondary" : "quiet"}
                      />
                      {snapshot.data.sources.map((source) => (
                        <ActionButton
                          accessibilityState={{
                            selected: sourceFilter === source.id,
                          }}
                          key={source.id}
                          label={source.name}
                          compact contentStyle={{ minHeight: 36 }} labelStyle={{ fontSize: 13 }}
                          onPress={() => setSourceFilter(source.id)}
                          tone={
                            sourceFilter === source.id ? "secondary" : "quiet"
                          }
                        />
                      ))}
                    </ScrollView>
                  ) : null}
                </>
              ) : null}
              {filtered ? (
                <ActionButton
                  icon="filter-remove-outline"
                  label="Clear filters"
                  onPress={() => {
                    setStatusFilter("all");
                    setSourceFilter(null);
                  }}
                />
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          !inventory.isLoading ? (
            <Text className="text-base text-muted-light dark:text-muted-dark">
              {filtered
                ? "No matching files found."
                : snapshot.data?.sources.length
                  ? "No files yet."
                  : "Add a backup folder to see its files here."}
            </Text>
          ) : (
            <LoadingState label="Loading files…" />
          )
        }
        ListFooterComponent={
          inventory.hasNextPage ? (
            <ActionButton
              disabled={inventory.isFetchingNextPage}
              label={inventory.isFetchingNextPage ? "Loading…" : "Show 20 more"}
              onPress={() => void inventory.fetchNextPage()}
            />
          ) : null
        }
      />
      {editingSourceId && snapshot.data ? (
        <SourceEditor key={editingSourceId} source={snapshot.data.sources.find((source) => source.id === editingSourceId)}
          sources={snapshot.data.sources} visible onClose={() => setEditingSourceId(undefined)}
          onEditExisting={setEditingSourceId} onSaved={() => { setEditingSourceId(undefined); void snapshot.refetch(); }} />
      ) : null}
    </SafeAreaView>
  );
}
