import { useState } from "react";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image, ScrollView, Text, View } from "react-native";
import { Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import webDavUploadEngine from "../../modules/webdav-upload-engine";
import { ActionButton, ErrorNotice, IconAction, LoadingState, Panel } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { uploadDetailPollInterval } from "@/lib/engine-polling";

type FileParams = {
  jobId?: string; sourceId?: string; fileName?: string; sourceName?: string;
  relativePath?: string; remotePath?: string; localUri?: string; mimeType?: string;
  modifiedAt?: string; presence?: string; byteCount?: string;
};

export default function UploadFailureScreen() {
  const params = useLocalSearchParams<FileParams>();
  const { jobId } = params;
  const router = useRouter();
  const focused = usePathname() === "/upload-failure";
  const [error, setError] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [failedLocalUri, setFailedLocalUri] = useState<string>();
  const [failedRemoteUri, setFailedRemoteUri] = useState<string>();
  const detail = useQuery({
    queryKey: ["engine", "upload-detail", jobId],
    queryFn: async () => {
      const result = await webDavUploadEngine.getUploadDetail(jobId!);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    enabled: Boolean(jobId) && focused,
    refetchInterval: (query) => uploadDetailPollInterval(query.state.data?.state, focused),
  });
  const job = detail.data;
  const fileName = params.fileName ?? job?.fileName;
  const mimeType = params.mimeType ?? job?.mimeType;
  const image = mimeType?.startsWith("image/");
  const localUri = params.localUri ?? job?.localUri;
  const sourceId = params.sourceId ?? job?.sourceId;
  const relativePath = params.relativePath ?? job?.relativePath;
  const remoteAvailable = params.presence === "both" || params.presence === "remote_only" || job?.state === "completed";
  const localAvailable = localUri && localUri !== failedLocalUri;
  const remote = useQuery({
    queryKey: ["remote-image", sourceId, relativePath, params.modifiedAt ?? job?.uploadedAt],
    enabled: Boolean(image && !localAvailable && remoteAvailable && sourceId && relativePath),
    queryFn: async () => {
      const result = await webDavUploadEngine.getRemoteImage(sourceId!, relativePath!, params.modifiedAt ?? job?.uploadedAt ?? null);
      if (!result.ok) throw new Error("The image could not be downloaded from Nextcloud.");
      return result.value;
    },
    retry: false,
    staleTime: Infinity,
  });
  const imageUri = localAvailable ? localUri : remote.data;
  const state = job?.state;
  const failed = state === "blocked" || state === "retry_wait";
  const uploaded = state === "completed" || !state && (params.presence === "both" || params.presence === "remote_only");
  const status = uploaded ? "Backed up to Nextcloud" : state === "running" ? "Uploading"
    : state === "queued" ? "Queued for upload" : state === "retry_wait" ? "Waiting to retry"
    : state === "blocked" ? "Upload failed" : state === "cancelled" ? "Upload cancelled" : "On phone only";
  const retry = async () => {
    if (!jobId) return;
    setRetrying(true);
    setError(undefined);
    try {
      const result = await webDavUploadEngine.retryUpload(jobId);
      if (!result.ok) setError(result.error.message);
      await detail.refetch();
    } catch { setError("Could not retry this upload."); }
    finally { setRetrying(false); }
  };
  const hasFile = Boolean(fileName);
  const showDetails = !image || detailsOpen;
  const byteCount = params.byteCount ? Number(params.byteCount) : job?.byteCount;
  const uploadedAt = job?.uploadedAt ? new Date(job.uploadedAt).toLocaleString() : undefined;

  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <View className="flex-row items-center gap-2 p-2">
        <IconAction icon="arrow-left" label="Back to Status" onPress={() => router.replace("/status")} />
        <Text numberOfLines={2} accessibilityRole="header" className="min-w-0 flex-1 text-base font-semibold text-ink-light dark:text-ink-dark">{fileName ?? "File details"}</Text>
      </View>
      {detail.isLoading && !hasFile ? <LoadingState label="Loading file…" /> : null}
      {detail.error || error ? <ErrorNotice message={error ?? "Upload details could not be loaded."} onRetry={() => void detail.refetch()} /> : null}
      {image ? (
        <View className="flex-1 items-center justify-center">
          {imageUri && imageUri !== failedRemoteUri ? (
            <Image key={imageUri} accessibilityLabel={fileName} source={{ uri: imageUri }}
              style={{ width: "100%", height: "100%" }} resizeMode="contain" resizeMethod="resize"
              onError={() => { if (localAvailable) setFailedLocalUri(imageUri); else setFailedRemoteUri(imageUri); }} />
          ) : remote.isFetching ? <LoadingState label="Loading image from Nextcloud…" /> : (
            <View className="items-center gap-2 p-2">
              <Icon source="image-off-outline" size={48} />
              <Text className="text-base text-muted-light dark:text-muted-dark">{remoteAvailable ? "This image could not be opened." : "This image is no longer available on this phone."}</Text>
              <ActionButton icon="reload" label="Retry image" onPress={() => {
                setFailedLocalUri(undefined); setFailedRemoteUri(undefined);
                if (!localAvailable && remoteAvailable) void remote.refetch();
              }} />
            </View>
          )}
        </View>
      ) : null}
      {hasFile ? (
        <ScrollView style={image ? { flexGrow: 0, maxHeight: "45%" } : { flex: 1 }} contentContainerClassName="gap-2 p-2">
          <Panel>
            <View className="flex-row items-center gap-2">
              <Icon source={uploaded ? "cloud-check-outline" : failed ? "alert-circle-outline" : "cloud-upload-outline"} size={24} />
              <View className="min-w-0 flex-1 gap-2">
                <Text accessibilityLiveRegion="polite" className="text-base font-semibold text-ink-light dark:text-ink-dark">{status}</Text>
                {uploadedAt ? <Text className="text-base text-muted-light dark:text-muted-dark">{uploadedAt}</Text> : null}
              </View>
              {image ? <IconAction icon={detailsOpen ? "chevron-down" : "information-outline"} label="File details"
                accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(!detailsOpen)} /> : null}
            </View>
            {failed ? (
              <>
                <Text className="text-base text-red-700 dark:text-red-300">{job?.errorMessage ?? "The upload could not be completed."}</Text>
                <ActionButton icon="reload" label="Retry this file" loading={retrying} disabled={retrying} onPress={() => void retry()} />
              </>
            ) : null}
            {showDetails ? (
              <View className="gap-2">
                <Text className="text-base text-muted-light dark:text-muted-dark">Backup folder</Text>
                <Text selectable className="text-base text-ink-light dark:text-ink-dark">{params.sourceName ?? job?.sourceName ?? "Removed backup"}</Text>
                {byteCount != null && Number.isFinite(byteCount) ? <Text className="text-base text-muted-light dark:text-muted-dark">{formatBytes(byteCount)}</Text> : null}
                <Text className="text-base text-muted-light dark:text-muted-dark">Nextcloud location</Text>
                <Text selectable className="text-base text-ink-light dark:text-ink-dark">{params.remotePath ?? job?.remotePath}</Text>
              </View>
            ) : null}
          </Panel>
        </ScrollView>
      ) : !detail.isLoading && !detail.error ? <Text className="p-2 text-base text-muted-light dark:text-muted-dark">This file is no longer in history.</Text> : null}
    </SafeAreaView>
  );
}
