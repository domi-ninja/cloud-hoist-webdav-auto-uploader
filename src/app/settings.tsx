import { Fragment, useState } from "react";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, Share, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { project } from "@/config/project";
import { useEngineSnapshot } from "@/lib/engine-query";
import webDavUploadEngine, {
  type TransferConstraints,
} from "../../modules/webdav-upload-engine";
import { ActionButton, Panel, Separator } from "@/components/ui";
import { AccountSettingsModal } from "@/features/account/AccountSettingsModal";
import { InstanceIcon } from "@/features/account/InstanceIcon";
import { transferRulesSummary } from "@/lib/upload-status";

type ConstraintKey = keyof TransferConstraints;

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ account?: string }>();
  const { data: snapshot, error, refetch } = useEngineSnapshot();
  const [saving, setSaving] = useState<ConstraintKey>();
  const [sharing, setSharing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [accountOpen, setAccountOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const closeAccount = () => {
    setAccountOpen(false);
    if (params.account === "open") router.setParams({ account: undefined });
  };

  const toggle = async (key: ConstraintKey) => {
    if (!snapshot) return;
    setSaving(key);
    setErrorMessage(undefined);
    const result = await webDavUploadEngine.setTransferConstraints({
      ...snapshot.scheduler.constraints,
      [key]: !snapshot.scheduler.constraints[key],
    });
    setSaving(undefined);
    if (!result.ok) setErrorMessage(result.error.message);
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
            void webDavUploadEngine.clearCompletedHistory().then((result) => {
              setClearing(false);
              if (!result.ok) setErrorMessage(result.error.message);
              else void refetch();
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4">
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
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
            <View className="flex-row items-center gap-4">
              <InstanceIcon compact serverUrl={snapshot.account.serverUrl} />
              <View className="shrink gap-4">
                <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                  {snapshot.account.displayName}
                </Text>
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  {new URL(snapshot.account.serverUrl).host}
                </Text>
              </View>
            </View>
            <ActionButton
              label="Account settings"
              onPress={() => setAccountOpen(true)}
            />
          </Panel>
        ) : null}
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Transfer rules
        </Text>
        {!snapshot && !error ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Loading settings…
          </Text>
        ) : null}
        {snapshot
          ? (
              <Panel>
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  {transferRulesSummary(snapshot.scheduler.constraints)}
                </Text>
                {options.map((option, index) => {
                  const checked = snapshot.scheduler.constraints[option.key];
                  return (
                    <Fragment key={option.key}>
                      {index ? <Separator /> : null}
                      <View className="flex-row items-center justify-between gap-4">
                        <Text className="shrink text-base text-ink-light dark:text-ink-dark">
                          {option.label}
                        </Text>
                        <Switch
                          accessibilityLabel={option.label}
                          disabled={saving !== undefined}
                          onValueChange={() => void toggle(option.key)}
                          thumbColor="#f4f4f0"
                          trackColor={{ false: "#62665d", true: "#4f7d45" }}
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
            )
          : null}
        <Panel>
          <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
            Diagnostics
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Share app and Android versions, queue counts, transfer rules, and recent engine
            codes. Account, file, and folder details are excluded.
          </Text>
          <ActionButton
            accessibilityLabel="Share diagnostic report"
            disabled={sharing}
            label={sharing ? "Opening share sheet…" : "Share diagnostics"}
            onPress={() => void shareDiagnostics()}
          />
        </Panel>
        {snapshot?.queue.uploaded ? (
          <Panel>
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Transfer history
            </Text>
            <Text className="text-base text-muted-light dark:text-muted-dark">
              Clear completed transfer records. Files on your phone and Nextcloud stay untouched.
            </Text>
            <ActionButton disabled={clearing} label={clearing ? "Clearing…" : "Clear completed history"}
              onPress={clearCompleted} tone="danger" />
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
      {(accountOpen || params.account === "open") && snapshot?.account.status === "connected" ? (
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
