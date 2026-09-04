import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Image, Linking, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import webDavUploadEngine, {
  type AccountHealth,
  type EngineError,
} from "../../../modules/webdav-upload-engine";
import {
  nextcloudInstanceIconUrl,
  nextcloudInstanceLabel,
} from "@/features/account/instance-icon";
import { useStoredAccountVerification } from "@/lib/engine-query";
import { formatRelativeTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { ActionButton, Panel, Separator } from "@/components/ui";

type AccountConnectionProps = {
  account: AccountHealth;
};

function errorText(error: EngineError) {
  return error.message;
}

function InstanceIcon({ serverUrl }: { serverUrl: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View
        accessibilityLabel="Nextcloud instance icon"
        accessibilityRole="image"
        accessible
        className="h-16 w-16 items-center justify-center bg-canvas-light dark:bg-canvas-dark"
      >
        <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
          NC
        </Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel="Nextcloud instance icon"
      className="h-16 w-16 bg-canvas-light dark:bg-canvas-dark"
      onError={() => setFailed(true)}
      resizeMode="contain"
      source={{ uri: nextcloudInstanceIconUrl(serverUrl) }}
    />
  );
}

export function AccountConnection({ account }: AccountConnectionProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [loginAttemptId, setLoginAttemptId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountVerification = useStoredAccountVerification(account);

  const pollLogin = useCallback(async () => {
    if (!loginAttemptId) {
      return;
    }
    const result = await webDavUploadEngine.pollLoginFlow(loginAttemptId);
    if (!result.ok) {
      setLoginAttemptId(undefined);
      setMessage(errorText(result.error));
      return;
    }
    if (result.value.status === "connected") {
      setLoginAttemptId(undefined);
      setMessage(undefined);
    }
  }, [loginAttemptId]);

  useEffect(() => {
    if (!loginAttemptId) {
      return;
    }
    const interval = setInterval(() => void pollLogin(), 2_000);
    return () => clearInterval(interval);
  }, [loginAttemptId, pollLogin]);

  const startBrowserLogin = async () => {
    if (!serverUrl.trim()) {
      setMessage("Enter your Nextcloud server URL.");
      return;
    }
    setBusy(true);
    setMessage(undefined);
    const result = await webDavUploadEngine.startLoginFlow(serverUrl);
    setBusy(false);
    if (!result.ok) {
      setMessage(errorText(result.error));
      return;
    }
    setLoginAttemptId(result.value.attemptId);
    try {
      await Linking.openURL(result.value.loginUrl);
    } catch {
      await webDavUploadEngine.cancelLoginFlow(result.value.attemptId);
      setLoginAttemptId(undefined);
      setMessage("The browser could not be opened.");
    }
  };

  const cancelBrowserLogin = async () => {
    if (!loginAttemptId) {
      return;
    }
    await webDavUploadEngine.cancelLoginFlow(loginAttemptId);
    setLoginAttemptId(undefined);
    setMessage(undefined);
  };

  const connectManual = async () => {
    if (!serverUrl.trim() || !username.trim() || !appPassword) {
      setMessage("Server URL, username, and app password are required.");
      return;
    }
    setBusy(true);
    setMessage(undefined);
    const password = appPassword;
    setAppPassword("");
    const result = await webDavUploadEngine.connectManual({
      serverUrl,
      username,
      appPassword: password,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(errorText(result.error));
    }
  };

  if (account.status === "connected") {
    return (
      <>
        <Pressable
          accessibilityLabel="Open account menu"
          accessibilityRole="button"
          accessibilityState={{ expanded: menuOpen }}
          className="items-center justify-center p-4"
          onPress={() => setMenuOpen((open) => !open)}
        >
          <View className="gap-1" pointerEvents="none">
            <View className="h-0.5 w-6 bg-ink-light dark:bg-ink-dark" />
            <View className="h-0.5 w-6 bg-ink-light dark:bg-ink-dark" />
            <View className="h-0.5 w-6 bg-ink-light dark:bg-ink-dark" />
          </View>
        </Pressable>
        <Modal
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
          statusBarTranslucent
          transparent
          visible={menuOpen}
        >
          <View accessibilityViewIsModal className="flex-1">
            <Pressable
              accessibilityLabel="Close account menu"
              className="absolute inset-0 bg-black/40"
              onPress={() => setMenuOpen(false)}
            />
            <View
              className="absolute w-80 gap-4 bg-panel-light p-4 dark:bg-panel-dark"
              style={{ right: 16, top: insets.top + 16 }}
            >
              <View className="flex-row items-center gap-4">
                <InstanceIcon key={account.serverUrl} serverUrl={account.serverUrl} />
                <View className="shrink gap-4">
                  <Text
                    className="text-base font-semibold text-ink-light dark:text-ink-dark"
                    numberOfLines={1}
                  >
                    {account.displayName}
                  </Text>
                  <Text
                    className="text-base text-muted-light dark:text-muted-dark"
                    numberOfLines={2}
                  >
                    {nextcloudInstanceLabel(account.serverUrl)}
                  </Text>
                </View>
              </View>
              <Separator />
              {accountVerification.isFetching ? (
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  Checking account…
                </Text>
              ) : accountVerification.error ? (
                <>
                  <Text className="text-base text-red-700 dark:text-red-300">
                    {accountVerification.error.message}
                  </Text>
                  <ActionButton
                    label="Retry account check"
                    onPress={() => void accountVerification.refetch()}
                    tone="primary"
                  />
                </>
              ) : (
                <Text className="text-base text-muted-light dark:text-muted-dark">
                  Checked {formatRelativeTime(account.checkedAt, now)}
                </Text>
              )}
              <ActionButton
                label="Account settings"
                onPress={() => {
                  setMenuOpen(false);
                  router.navigate("/settings");
                }}
              />
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <Panel>
      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
        Connect Nextcloud
      </Text>
      {busy ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-muted-light dark:text-muted-dark"
        >
          Checking account…
        </Text>
      ) : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-red-700 dark:text-red-300"
        >
          {message}
        </Text>
      ) : null}
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        className="border border-accent p-4 text-base text-ink-light dark:text-ink-dark"
        editable={!busy}
        onChangeText={setServerUrl}
        placeholder="https://cloud.example.com"
        placeholderTextColor="#737373"
        value={serverUrl}
      />

      {showManual ? (
        <>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="border border-accent p-4 text-base text-ink-light dark:text-ink-dark"
            editable={!busy}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#737373"
            value={username}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="border border-accent p-4 text-base text-ink-light dark:text-ink-dark"
            editable={!busy}
            onChangeText={setAppPassword}
            placeholder="App password"
            placeholderTextColor="#737373"
            secureTextEntry
            value={appPassword}
          />
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Use a Nextcloud app password, never your main account password.
          </Text>
          <ActionButton
            disabled={busy}
            label="Connect with app password"
            onPress={() => void connectManual()}
            tone="primary"
          />
        </>
      ) : loginAttemptId ? (
        <>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Finish signing in in your browser. This screen will update automatically.
          </Text>
          <ActionButton
            label="Cancel browser login"
            onPress={() => void cancelBrowserLogin()}
          />
        </>
      ) : (
        <>
          <ActionButton
            disabled={busy}
            label="Continue in browser"
            onPress={() => void startBrowserLogin()}
            tone="primary"
          />
          <ActionButton
            disabled={busy}
            label="Use app credentials instead"
            onPress={() => setShowManual(true)}
          />
        </>
      )}
    </Panel>
  );
}
