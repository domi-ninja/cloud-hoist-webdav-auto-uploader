import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Linking, Text, View } from "react-native";
import { useState } from "react";

import { expo } from "../../../app.json";
import { ActionButton, Panel } from "@/components/ui";
import { checkAppUpdates, updateChannel } from "./app-updates";

export function AppUpdates() {
  const version = Constants.expoConfig?.version ?? expo.version;
  const versionCode = Constants.expoConfig?.android?.versionCode ?? expo.android.versionCode;
  const channel = updateChannel(Constants.expoConfig?.extra?.updateChannel);
  const provider = channel === "beta" ? "GitHub" : "F-Droid";
  const [openError, setOpenError] = useState<string>();
  const update = useQuery({
    queryKey: ["app-updates", channel, versionCode],
    queryFn: () => checkAppUpdates(versionCode, channel),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });
  const status = update.isFetching ? `Version ${version}, checking for updates…`
    : update.isError ? `Version ${version}. ${update.error.message}`
    : update.data?.status === "available" ? `Version ${version}. Version ${update.data.version} available on ${provider}.`
    : update.data?.status === "up-to-date" ? `Version ${version}, up to date.`
    : `Version ${version}. Updates have not been checked.`;

  const openUpdate = async () => {
    if (update.data?.status !== "available") return;
    setOpenError(undefined);
    try {
      await Linking.openURL(update.data.url);
    } catch {
      setOpenError(`${provider} could not be opened.`);
    }
  };

  return (
    <Panel>
      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">App updates</Text>
      <Text
        accessibilityLiveRegion="polite"
        className={update.isError && !update.isFetching
          ? "text-base text-red-700 dark:text-red-300"
          : "text-base text-muted-light dark:text-muted-dark"}
      >
        {status}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <ActionButton icon="refresh" label="Check for updates" loading={update.isFetching}
          disabled={update.isFetching} onPress={() => void update.refetch()} />
        {update.data?.status === "available" && !update.isError && !update.isFetching ? (
          <ActionButton icon="download" label={channel === "beta" ? "Download update" : "Open F-Droid"} onPress={() => void openUpdate()} />
        ) : null}
      </View>
      {openError ? <Text accessibilityLiveRegion="polite" className="text-base text-red-700 dark:text-red-300">{openError}</Text> : null}
    </Panel>
  );
}
