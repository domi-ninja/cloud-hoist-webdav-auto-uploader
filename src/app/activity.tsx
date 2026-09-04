import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import webDavUploadEngine from "../../modules/webdav-upload-engine";
import { useRecentActivity, useUnresolvedFailures } from "@/lib/engine-query";

export default function ActivityScreen() {
  const activity = useRecentActivity();
  const failures = useUnresolvedFailures();
  const [errorMessage, setErrorMessage] = useState<string>();

  const retryFailed = async () => {
    const result = await webDavUploadEngine.retryFailed();
    if (!result.ok) setErrorMessage(result.error.message);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Activity
        </Text>
        {activity.isLoading || failures.isLoading ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Loading activity…
          </Text>
        ) : null}
        {activity.error || failures.error || errorMessage ? (
          <Text className="text-base text-red-700 dark:text-red-300">
            {errorMessage ?? "Activity could not be loaded."}
          </Text>
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
