import { useEffect, useState } from "react";
import { AppState, Linking, Text, View } from "react-native";
import Constants from "expo-constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, Portal } from "react-native-paper";

import app from "../../../app.json";
import { ActionButton, Panel } from "@/components/ui";
import {
  fetchAvailableUpdate,
  releasesUrl,
  updateConfig,
  type AppRelease,
} from "./app-update";
import { openUpdate } from "./open-app-update";

const updateKey = ["app-update"] as const;

function useAppUpdate() {
  const installedBuild = Constants.expoConfig?.android?.versionCode ?? app.expo.android.versionCode;
  return useQuery({
    queryKey: [...updateKey, installedBuild],
    queryFn: () => fetchAvailableUpdate(installedBuild),
    enabled: !__DEV__,
    retry: false,
    staleTime: 60 * 60 * 1_000,
    refetchInterval: 6 * 60 * 60 * 1_000,
    refetchIntervalInBackground: false,
  });
}

function UpdateAction({ release, onOpened }: { release: AppRelease; onOpened?: () => void }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(false);
  const open = async () => {
    setOpening(true);
    setError(false);
    try {
      await openUpdate(release);
      onOpened?.();
    } catch {
      setError(true);
    } finally {
      setOpening(false);
    }
  };
  return (
    <View className="gap-2">
      <ActionButton
        icon={updateConfig.appIsInStore ? "open-in-new" : "download"}
        label={updateConfig.appIsInStore ? "Update" : "Download APK"}
        loading={opening}
        disabled={opening}
        onPress={() => void open()}
        tone="primary"
      />
      {error ? (
        <Text accessibilityRole="alert" className="text-base text-red-700 dark:text-red-300">
          Could not open the update. Try again.
        </Text>
      ) : null}
    </View>
  );
}

export function AutomaticUpdatePrompt() {
  const query = useAppUpdate();
  const client = useQueryClient();
  const [dismissedBuild, setDismissedBuild] = useState<number>();

  useEffect(function recheckUpdatesOnForeground() {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void client.refetchQueries({ queryKey: updateKey, type: "active", stale: true });
      }
    });
    return () => subscription.remove();
  }, [client]);

  const release = query.data;
  if (!release || release.versionCode <= (dismissedBuild ?? 0)) return null;
  const dismiss = () => setDismissedBuild(release.versionCode);
  return (
    <Portal>
      <Dialog visible onDismiss={dismiss}>
        <Dialog.Title style={{ fontSize: 16 }}>Update available</Dialog.Title>
        <Dialog.Content>
          <Text className="text-base text-ink-light dark:text-ink-dark">
            {updateConfig.appName} {release.version} · Build {release.versionCode}
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={{ flexWrap: "wrap", gap: 8 }}>
          <ActionButton label="Later" onPress={dismiss} />
          <UpdateAction release={release} onOpened={dismiss} />
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

export function AppUpdates() {
  const query = useAppUpdate();
  const [downloadError, setDownloadError] = useState(false);
  const openDownloads = async () => {
    setDownloadError(false);
    try { await Linking.openURL(releasesUrl); } catch { setDownloadError(true); }
  };
  return (
    <Panel>
      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">App updates</Text>
      {query.data ? (
        <>
          <Text className="text-base text-ink-light dark:text-ink-dark">
            {query.data.version} · Build {query.data.versionCode} available
          </Text>
          <UpdateAction release={query.data} />
        </>
      ) : query.error ? (
        <Text accessibilityLiveRegion="polite" className="text-base text-red-700 dark:text-red-300">
          Could not check for updates.
        </Text>
      ) : query.isSuccess ? (
        <Text accessibilityLiveRegion="polite" className="text-base text-muted-light dark:text-muted-dark">
          No update available.
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <ActionButton
          icon="refresh"
          label={query.isFetching ? "Checking…" : "Check for updates"}
          loading={query.isFetching}
          disabled={query.isFetching}
          onPress={() => void query.refetch()}
        />
        {query.error ? <ActionButton icon="download" label="Open downloads" onPress={() => void openDownloads()} /> : null}
      </View>
      {downloadError ? <Text accessibilityRole="alert" className="text-base text-red-700 dark:text-red-300">Could not open downloads. Try again.</Text> : null}
    </Panel>
  );
}
