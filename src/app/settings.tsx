import { Fragment, useState } from "react";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, Share, Text, View } from "react-native";
import { Switch } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { project } from "@/config/project";
import { useEngineSnapshot } from "@/lib/engine-query";
import webDavUploadEngine, {
  type TransferConstraints,
} from "../../modules/webdav-upload-engine";
import { IconAction, Panel, Separator } from "@/components/ui";
import { AccountSettingsModal } from "@/features/account/AccountSettingsModal";
import { InstanceIcon } from "@/features/account/InstanceIcon";
import { RemoteFolderPicker } from "@/features/sources/RemoteFolderPicker";
import { formatRemoteRoot, useAppPreferences } from "@/lib/app-preferences";

type ConstraintKey = keyof TransferConstraints;

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ account?: string }>();
  const { data: snapshot, error, refetch } = useEngineSnapshot();
  const { remoteRootPath, setRemoteRootPath } = useAppPreferences();
  const [saving, setSaving] = useState<ConstraintKey>();
  const [sharing, setSharing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [accountOpen, setAccountOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [choosingRoot, setChoosingRoot] = useState(false);
  const [rootError, setRootError] = useState<string>();
  const [savingRoot, setSavingRoot] = useState(false);

  const selectRemoteRoot = async (pathSegments: string[]) => {
    setSavingRoot(true);
    setRootError(undefined);
    setChoosingRoot(false);
    try {
      await setRemoteRootPath(pathSegments);
    } catch {
      setRootError("The upload root could not be saved.");
    } finally {
      setSavingRoot(false);
    }
  };

  const closeAccount = () => {
    setAccountOpen(false);
    if (params.account === "open") router.setParams({ account: undefined });
  };

  const toggle = async (key: ConstraintKey) => {
    if (!snapshot) return;
    setSaving(key);
    setErrorMessage(undefined);
    try {
      const result = await webDavUploadEngine.setTransferConstraints({
        ...snapshot.scheduler.constraints,
        [key]: !snapshot.scheduler.constraints[key],
      });
      if (!result.ok) setErrorMessage(result.error.message);
    } catch {
      setErrorMessage("Transfer rules could not be saved. Please try again.");
    } finally {
      setSaving(undefined);
    }
  };

  const options: { key: ConstraintKey; label: string }[] = [
    { key: "unmeteredOnly", label: "Wi-Fi or unmetered network only" },
    { key: "batteryNotLow", label: "Wait when battery is low" },
    { key: "requiresCharging", label: "Upload only while charging" },
  ];

  const shareDiagnostics = async () => {
    setSharing(true);
    setErrorMessage(undefined);
    try {
      const report = await webDavUploadEngine.getDiagnosticReport();
      if (!report.ok) {
        setErrorMessage(report.error.message);
        return;
      }
      await Share.share({
        message: report.value,
        title: "WebDAV Auto Upload diagnostics",
      });
    } catch {
      setErrorMessage(
        "The diagnostic report could not be shared. Please try again.",
      );
    } finally {
      setSharing(false);
    }
  };

  const clearCompleted = () => {
    Alert.alert(
      "Clear completed history?",
      "Completed transfer records are removed. Files on your phone and Nextcloud stay, and the file inventory remains available.",
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
                else void refetch();
              })
              .catch(() =>
                setErrorMessage(
                  "History could not be cleared. Please try again.",
                ),
              )
              .finally(() => setClearing(false));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-canvas-light dark:bg-canvas-dark"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="gap-2 p-2"
      >
        <Text
          accessibilityRole="header"
          className="text-base font-semibold text-ink-light dark:text-ink-dark"
        >
          Settings
        </Text>
        {error || errorMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-red-700 dark:text-red-300"
          >
            {errorMessage ?? "Settings could not be loaded."}
          </Text>
        ) : null}
        {snapshot?.account.status === "connected" ? (
          <Panel>
            <View className="flex-row items-center gap-2">
              <InstanceIcon compact serverUrl={snapshot.account.serverUrl} />
              <View className="flex-1 gap-2">
                <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                  {snapshot.account.displayName}
                </Text>
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  {new URL(snapshot.account.serverUrl).host}
                </Text>
              </View>
              <IconAction
                icon="account-cog-outline"
                label="Account settings"
                onPress={() => setAccountOpen(true)}
              />
            </View>
          </Panel>
        ) : null}
        <Panel>
          <View className="flex-row items-center gap-2">
            <View className="flex-1 gap-2">
              <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                Nextcloud upload root
              </Text>
              <Text className="text-base text-muted-light dark:text-muted-dark">
                {formatRemoteRoot(remoteRootPath)}
              </Text>
            </View>
            <IconAction
              icon={choosingRoot ? "chevron-up" : "folder-edit-outline"}
              disabled={savingRoot || snapshot?.account.status !== "connected"}
              accessibilityState={{ expanded: choosingRoot }}
              label={
                choosingRoot ? "Hide folder browser" : "Choose upload root"
              }
              onPress={() => setChoosingRoot((open) => !open)}
              tone="primary"
            />
          </View>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            New backups go here, followed by their local parent and folder name.
            Use / to upload from the Nextcloud account root.
          </Text>
          {rootError ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-base text-red-700 dark:text-red-300"
            >
              {rootError}
            </Text>
          ) : null}
        </Panel>
        {choosingRoot ? (
          <RemoteFolderPicker
            onClose={() => setChoosingRoot(false)}
            initialPathSegments={remoteRootPath}
            onSelect={(pathSegments) => void selectRemoteRoot(pathSegments)}
            title="Choose upload root"
          />
        ) : null}
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Transfer rules
        </Text>
        {!snapshot && !error ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Loading settings…
          </Text>
        ) : null}
        {snapshot ? (
          <Panel>
            {options.map((option, index) => {
              const checked = snapshot.scheduler.constraints[option.key];
              return (
                <Fragment key={option.key}>
                  {index ? <Separator /> : null}
                  <View className="min-h-12 flex-row items-center justify-between gap-2">
                    <Text className="shrink text-base text-ink-light dark:text-ink-dark">
                      {option.label}
                    </Text>
                    <Switch
                      hitSlop={8}
                      accessibilityLabel={option.label}
                      disabled={saving !== undefined}
                      onValueChange={() => void toggle(option.key)}
                      value={checked}
                    />
                  </View>
                </Fragment>
              );
            })}
            {saving ? (
              <Text
                accessibilityLiveRegion="polite"
                className="text-base text-muted-light dark:text-muted-dark"
              >
                Saving transfer rules…
              </Text>
            ) : null}
          </Panel>
        ) : null}
        <Panel>
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Diagnostics
            </Text>
            <IconAction
              icon="share-variant-outline"
              accessibilityLabel="Share diagnostic report"
              disabled={sharing}
              label={sharing ? "Opening share sheet…" : "Share diagnostics"}
              onPress={() => void shareDiagnostics()}
            />
          </View>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Share app and Android versions, queue counts, transfer rules, and
            recent engine codes. Account, file, and folder details are excluded.
          </Text>
        </Panel>
        {snapshot?.queue.uploaded ? (
          <Panel>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                Transfer history
              </Text>
              <IconAction
                icon="delete-outline"
                disabled={clearing}
                label={clearing ? "Clearing…" : "Clear completed history"}
                onPress={clearCompleted}
                tone="danger"
              />
            </View>
            <Text className="text-base text-muted-light dark:text-muted-dark">
              Clear completed transfer records. Files on your phone and
              Nextcloud stay untouched.
            </Text>
          </Panel>
        ) : null}
        <Panel>
          <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
            About
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            {project.displayName} · {project.license}
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Version {Constants.expoConfig?.version ?? "unknown"}
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            {project.compatibilityNotice}
          </Text>
        </Panel>
      </ScrollView>
      {(accountOpen || params.account === "open") &&
      snapshot?.account.status === "connected" ? (
        <AccountSettingsModal
          account={snapshot.account}
          key={snapshot.account.id}
          onClose={closeAccount}
          onSignedOut={() => {
            closeAccount();
            router.navigate("/");
          }}
          visible
        />
      ) : null}
    </SafeAreaView>
  );
}
