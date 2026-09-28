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

import webDavUploadEngine, {
  type AccountSummary,
  type EngineError,
} from "../../../modules/webdav-upload-engine";
import {
  ActionButton,
  FormField,
  IconAction,
  Panel,
  Separator,
} from "@/components/ui";
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
  onSignedOut: () => void;
};

export function AccountSettingsModal({
  account,
  visible,
  onClose,
  onSignedOut,
}: AccountSettingsModalProps) {
  const now = useNow();
  const verification = useStoredAccountVerification({
    ...account,
    status: "connected",
  });
  const initialValue = initialAccountSettings(account);
  const [serverUrl, setServerUrl] = useState(initialValue.serverUrl);
  const [username, setUsername] = useState(initialValue.username);
  const [appPassword, setAppPassword] = useState(initialValue.appPassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError>();
  const value = { serverUrl, username, appPassword };
  const changed = accountSettingsChanged(account, value);
  const canSave = canSaveAccountSettings(account, value) && !busy;

  const close = () => {
    if (busy) return;
    if (!changed) {
      onClose();
      return;
    }
    Alert.alert(
      "Discard account changes?",
      "Your unsaved changes will be lost.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ],
    );
  };

  const replaceAccount = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(undefined);
    const password = appPassword;
    const result = await webDavUploadEngine.replaceManualAccount({
      serverUrl,
      username,
      appPassword: password,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAppPassword("");
    onClose();
  };

  const save = () => {
    if (!canSave) return;
    Alert.alert(
      "Replace connected account?",
      "The app will verify these credentials first. Existing backup folders and queued uploads will then use the replacement account.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Replace account", onPress: () => void replaceAccount() },
      ],
    );
  };

  const signOut = () => {
    Alert.alert(
      "Sign out and remove local data?",
      "This removes the account, backup folders, queue, and local history. Local files and files already uploaded to Nextcloud stay untouched.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            setError(undefined);
            void webDavUploadEngine.signOut().then((result) => {
              setBusy(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              onSignedOut();
            });
          },
        },
      ],
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
        <View className="flex-row items-center justify-between gap-2 p-2">
          <IconAction
            icon="close"
            disabled={busy}
            label="Cancel"
            onPress={close}
          />
          <Text
            accessibilityRole="header"
            className="shrink text-base font-semibold text-ink-light dark:text-ink-dark"
          >
            Account settings
          </Text>
          <IconAction
            icon="check"
            label={busy ? "Saving…" : "Save account settings"}
            disabled={!canSave}
            loading={busy}
            onPress={save}
          />
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-2 p-2"
            keyboardShouldPersistTaps="handled"
          >
            <Panel>
              <View className="flex-row items-center gap-2">
                <InstanceIcon serverUrl={account.serverUrl} />
                <View className="shrink gap-2">
                  <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                    {account.displayName}
                  </Text>
                  <Text className="text-base text-muted-light dark:text-muted-dark">
                    {nextcloudInstanceLabel(account.serverUrl)}
                  </Text>
                </View>
              </View>
              <Separator />
              {verification.isFetching ? (
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  Checking account…
                </Text>
              ) : verification.error ? (
                <>
                  <Text className="text-base text-red-700 dark:text-red-300">
                    {verification.error.message}
                  </Text>
                  <ActionButton
                    label="Retry account check"
                    onPress={() => void verification.refetch()}
                    tone="primary"
                  />
                </>
              ) : (
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  Last checked{" "}
                  {formatRelativeTime(
                    verification.data?.checkedAt ?? account.checkedAt,
                    now,
                  )}
                </Text>
              )}
            </Panel>
            <Panel>
              <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
                Replace connection
              </Text>
              <Text className="text-base text-muted-light dark:text-muted-dark">
                Enter all three values to move the existing backup folders to
                another account.
              </Text>
              <FormField
                label="Nextcloud server URL"
                keyboardType="url"
                accessibilityLabel="Nextcloud server URL"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onChangeText={setServerUrl}
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
                label="Nextcloud app password"
                autoComplete="current-password"
                accessibilityLabel="Nextcloud app password"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onChangeText={setAppPassword}
                placeholder="App password required to save"
                secureTextEntry
                value={appPassword}
              />
            </Panel>
            {error ? (
              <Text
                accessibilityLiveRegion="polite"
                className="text-base text-red-700 dark:text-red-300"
              >
                {error.message}
              </Text>
            ) : null}
            <ActionButton
              icon="logout"
              accessibilityLabel="Sign out and remove local data"
              disabled={busy}
              label="Sign out and remove local data"
              onPress={signOut}
              tone="danger"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
