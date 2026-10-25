import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Linking, Text, View } from "react-native";
import { useState } from "react";

import { expo } from "../../../app.json";
import { ActionButton, Panel } from "@/components/ui";
import { project } from "@/config/project";
import { checkAppUpdates } from "./app-updates";

export function AppUpdates() {
  const version = Constants.expoConfig?.version ?? expo.version;
  const versionCode = Constants.expoConfig?.android?.versionCode ?? expo.android.versionCode;
  const [openError, setOpenError] = useState<string>();
  const update = useQuery({
    queryKey: ["app-updates", versionCode],
    queryFn: () => checkAppUpdates(versionCode),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });
  const status = update.isFetching ? `Version ${version}, checking for updates…`
    : update.isError ? `Version ${version}. ${update.error.message}`
    : update.data?.status === "available" ? `Version ${version}. Version ${update.data.version} available on F-Droid.`
    : update.data?.status === "up-to-date" ? `Version ${version}, up to date.`
    : `Version ${version}. Updates have not been checked.`;

  const openFdroid = async () => {
    setOpenError(undefined);
    try {
      await Linking.openURL(`https://f-droid.org/packages/${project.androidPackage}/`);
    } catch {
      setOpenError("F-Droid could not be opened.");
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
          <ActionButton label="Open F-Droid" onPress={() => void openFdroid()} />
        ) : null}
      </View>
      {openError ? <Text accessibilityLiveRegion="polite" className="text-base text-red-700 dark:text-red-300">{openError}</Text> : null}
    </Panel>
  );
}
