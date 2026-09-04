import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { project } from "@/config/project";
import { useEngineSnapshot } from "@/lib/engine-query";
import { formatRelativeTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import webDavUploadEngine, {
  type TransferConstraints,
} from "../../modules/webdav-upload-engine";

type ConstraintKey = keyof TransferConstraints;

export default function SettingsScreen() {
  const router = useRouter();
  const { data: snapshot, error } = useEngineSnapshot();
  const [saving, setSaving] = useState<ConstraintKey>();
  const [sharing, setSharing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const now = useNow();

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

  const signOut = () => {
    Alert.alert(
      "Sign out and remove local data?",
      "This removes the account, sources, queue, and local history. Local files and files already uploaded to Nextcloud stay untouched.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => {
            void webDavUploadEngine.signOut().then((result) => {
              if (!result.ok) {
                setErrorMessage(result.error.message);
                return;
              }
              router.navigate("/");
            });
          },
        },
      ],
    );
  };

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
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          Transfer rules
        </Text>
        {!snapshot && !error ? (
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Loading settings…
          </Text>
        ) : null}
        {snapshot
          ? options.map((option) => {
              const checked = snapshot.scheduler.constraints[option.key];
              return (
                <Pressable
                  accessibilityLabel={option.label}
                  accessibilityRole="switch"
                  accessibilityState={{ checked, disabled: saving !== undefined }}
                  className="flex-row items-center justify-between gap-4 border border-accent p-4 disabled:opacity-50"
                  disabled={saving !== undefined}
                  key={option.key}
                  onPress={() => void toggle(option.key)}
                >
                  <Text className="shrink text-base text-ink-light dark:text-ink-dark">
                    {option.label}
                  </Text>
                  <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                    {saving === option.key ? "Saving…" : checked ? "On" : "Off"}
                  </Text>
                </Pressable>
              );
            })
          : null}
        {snapshot?.account.status === "connected" ? (
          <View className="gap-4 border border-muted-light p-4 dark:border-muted-dark">
            <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
              Account
            </Text>
            <Text className="text-base text-muted-light dark:text-muted-dark">
              {snapshot.account.displayName} · {snapshot.account.serverUrl}
            </Text>
            <Text className="text-base text-muted-light dark:text-muted-dark">
              Checked {formatRelativeTime(snapshot.account.checkedAt, now)}
            </Text>
            <Pressable
              accessibilityLabel="Sign out and remove local data"
              accessibilityRole="button"
              className="p-4"
              onPress={signOut}
            >
              <Text className="text-base text-red-700 dark:text-red-300">Sign out</Text>
            </Pressable>
          </View>
        ) : null}
        <View className="gap-4 border border-muted-light p-4 dark:border-muted-dark">
          <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
            Diagnostics
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Share app and Android versions, queue counts, transfer rules, and recent engine
            codes. Account, file, and folder details are excluded.
          </Text>
          <Pressable
            accessibilityLabel="Share private diagnostic report"
            accessibilityRole="button"
            className="border border-accent p-4 disabled:opacity-50"
            disabled={sharing}
            onPress={() => void shareDiagnostics()}
          >
            <Text className="text-base text-ink-light dark:text-ink-dark">
              {sharing ? "Opening share sheet…" : "Share diagnostics"}
            </Text>
          </Pressable>
        </View>
        <View className="gap-4 border border-muted-light p-4 dark:border-muted-dark">
          <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
            About
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            {project.displayName} · {project.license}
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            {project.compatibilityNotice}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
