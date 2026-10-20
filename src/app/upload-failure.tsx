import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import webDavUploadEngine from "../../modules/webdav-upload-engine";
import { ActionButton, ErrorNotice, IconAction, LoadingState, Panel } from "@/components/ui";
import { formatBytes } from "@/lib/format";

export default function UploadFailureScreen() {
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const detail = useQuery({
    queryKey: ["engine", "upload-detail", jobId],
    queryFn: async () => {
      const result = await webDavUploadEngine.getUploadDetail(jobId!);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    enabled: Boolean(jobId),
    refetchInterval: 1_000,
  });
  const job = detail.data;
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
  const state = job?.state;
  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <View className="flex-row items-center gap-2 p-2">
        <IconAction icon="arrow-left" label="Back to Status" onPress={() => router.replace("/status")} />
        <Text accessibilityRole="header" className="text-base font-semibold text-ink-light dark:text-ink-dark">Upload details</Text>
      </View>
      <ScrollView contentContainerClassName="gap-2 p-2">
        {detail.isLoading ? <LoadingState label="Loading upload…" /> : null}
        {detail.error || error ? <ErrorNotice message={error ?? "This upload could not be loaded."} onRetry={() => void detail.refetch()} /> : null}
        {job ? (
          <Panel>
            <Text selectable className="text-base font-semibold text-ink-light dark:text-ink-dark">{job.fileName}</Text>
            <Text className="text-base text-muted-light dark:text-muted-dark">{job.sourceName} · {formatBytes(job.byteCount)}</Text>
            <Text selectable className="text-base text-muted-light dark:text-muted-dark">{job.remotePath}</Text>
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              {state === "completed" ? "Uploaded" : state === "running" ? "Uploading" : state === "queued" ? "Queued" : state === "retry_wait" ? "Waiting to retry" : "Upload failed"}
            </Text>
            {state === "blocked" || state === "retry_wait" ? (
              <>
                <Text className="text-base text-ink-light dark:text-ink-dark">{job.errorMessage ?? "The upload could not be completed."}</Text>
                <Text className="text-base text-muted-light dark:text-muted-dark">{job.attemptCount} {job.attemptCount === 1 ? "attempt" : "attempts"}</Text>
                <ActionButton icon="reload" label="Retry this file" loading={retrying} disabled={retrying} onPress={() => void retry()} />
              </>
            ) : null}
          </Panel>
        ) : !detail.isLoading && !detail.error ? <Text className="text-base text-muted-light dark:text-muted-dark">This upload is no longer in history.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
