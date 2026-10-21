import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { completeServerUrl } from "./server-url";

import webDavUploadEngine, {
  type AccountSummary,
  type EngineError,
} from "../../../modules/webdav-upload-engine";
import { ActionButton, FormField, IconAction, Panel, Separator } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";
import { useStoredAccountVerification } from "@/lib/engine-query";
import { useNow } from "@/lib/use-now";
import { InstanceIcon } from "./InstanceIcon";
import { nextcloudInstanceLabel } from "./instance-icon";
import {
  accountSettingsChanged,
  canSaveAccountSettings,
  initialAccountSettings,
} from "./account-settings-state";

type AccountSettingsModalProps = {
  account: AccountSummary;
  visible: boolean;
  onClose: () => void;
};

export function AccountSettingsModal({ account, visible, onClose }: AccountSettingsModalProps) {
  const now = useNow();
  const verification = useStoredAccountVerification({ ...account, status: "connected" });
  const initialValue = initialAccountSettings(account);
  const [editing, setEditing] = useState(false);
  const [serverUrl, setServerUrl] = useState(initialValue.serverUrl);
  const [username, setUsername] = useState(initialValue.username);
  const [appPassword, setAppPassword] = useState(initialValue.appPassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError>();
  const value = { serverUrl, username, appPassword };
  const changed = accountSettingsChanged(account, value);
  const canSave = canSaveAccountSettings(account, value) && !busy;

  const edit = () => {
    setServerUrl(account.serverUrl);
    setUsername(account.username);
    setAppPassword("");
    setError(undefined);
    setEditing(true);
  };

  const close = () => {
    if (busy) return;
    if (!editing) {
      onClose();
      return;
    }
    const discard = () => {
      setAppPassword("");
      setError(undefined);
      setEditing(false);
    };
    if (!changed) {
      discard();
      return;
    }
    Alert.alert("Discard connection changes?", "Your unsaved changes will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: discard },
    ]);
  };

  const saveConnection = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await webDavUploadEngine.replaceManualAccount({ serverUrl: completeServerUrl(serverUrl), username, appPassword });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAppPassword("");
      setEditing(false);
      void verification.refetch();
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!canSave) return;
    Alert.alert(
      "Save connection changes?",
      "Backup folders and queued uploads will use this connection.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save connection", onPress: () => void saveConnection() },
      ],
    );
  };

  return (
    <Modal animationType="slide" onRequestClose={close} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
        <View className="flex-row items-center gap-2 p-2">
          <IconAction
            icon={editing ? "arrow-left" : "close"}
            disabled={busy}
            label={editing ? "Cancel editing" : "Close account settings"}
            onPress={close}
          />
          <Text accessibilityRole="header" className="flex-1 text-base font-semibold text-ink-light dark:text-ink-dark">
            {editing ? "Edit connection" : "Account settings"}
          </Text>
          {editing ? (
            <IconAction
              icon="check"
              label={busy ? "Saving…" : "Save connection"}
              disabled={!canSave}
              loading={busy}
              onPress={save}
            />
          ) : null}
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView className="flex-1" contentContainerClassName="gap-2 p-2" keyboardShouldPersistTaps="handled">
            {editing ? (
              <Panel>
                <FormField
                  label="Nextcloud server URL"
                  keyboardType="url"
                  accessibilityLabel="Nextcloud server URL"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  onChangeText={setServerUrl}
                  onBlur={() => setServerUrl(completeServerUrl(serverUrl))}
                  placeholder="https://cloud.example.com"
                  value={serverUrl}
                />
                <FormField
                  label="Nextcloud username"
                  autoComplete="username"
                  accessibilityLabel="Nextcloud username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  onChangeText={setUsername}
                  placeholder="Username"
                  value={username}
                />
                <FormField
                  label="New app password"
                  autoComplete="current-password"
                  accessibilityLabel="New app password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  onChangeText={setAppPassword}
                  placeholder="Enter an app password to save changes"
                  secureTextEntry
                  value={appPassword}
                />
              </Panel>
            ) : (
              <>
                <Panel>
                  <View className="flex-row items-center gap-2">
                    <InstanceIcon serverUrl={account.serverUrl} />
                    <View className="shrink gap-2">
                      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">{account.displayName}</Text>
                      <Text className="text-base text-muted-light dark:text-muted-dark">{nextcloudInstanceLabel(account.serverUrl)}</Text>
                    </View>
                  </View>
                  <Separator />
                  <Text className="text-base text-muted-light dark:text-muted-dark">Nextcloud server URL</Text>
                  <Text selectable className="text-base text-ink-light dark:text-ink-dark">{account.serverUrl}</Text>
                  <Text className="text-base text-muted-light dark:text-muted-dark">Nextcloud username</Text>
                  <Text selectable className="text-base text-ink-light dark:text-ink-dark">{account.username}</Text>
                  <Text className="text-base text-muted-light dark:text-muted-dark">Nextcloud app password</Text>
                  <Text className="text-base text-ink-light dark:text-ink-dark">Saved securely</Text>
                  <Separator />
                  {verification.isFetching ? (
                    <Text className="text-base text-muted-light dark:text-muted-dark">Checking account…</Text>
                  ) : verification.error ? (
                    <>
                      <Text className="text-base text-red-700 dark:text-red-300">{verification.error.message}</Text>
                      <ActionButton label="Retry account check" onPress={() => void verification.refetch()} tone="primary" />
                    </>
                  ) : (
                    <Text className="text-base text-muted-light dark:text-muted-dark">
                      Last checked {formatRelativeTime(verification.data?.checkedAt ?? account.checkedAt, now)}
                    </Text>
                  )}
                </Panel>
                <ActionButton icon="pencil-outline" label="Edit connection" onPress={edit} />
              </>
            )}
            {error ? (
              <Text accessibilityLiveRegion="polite" className="text-base text-red-700 dark:text-red-300">{error.message}</Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
