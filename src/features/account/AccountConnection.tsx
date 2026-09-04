import { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, TextInput, View } from "react-native";

import webDavUploadEngine, {
  type AccountHealth,
  type EngineError,
} from "../../../modules/webdav-upload-engine";
import {
  nextcloudInstanceIconUrl,
  nextcloudInstanceLabel,
} from "@/features/account/instance-icon";
import { useStoredAccountVerification } from "@/lib/engine-query";

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
        className="h-16 w-16 items-center justify-center border border-accent"
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
      className="h-16 w-16 border border-accent"
      onError={() => setFailed(true)}
      resizeMode="contain"
      source={{ uri: nextcloudInstanceIconUrl(serverUrl) }}
    />
  );
}

export function AccountConnection({ account }: AccountConnectionProps) {
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [loginAttemptId, setLoginAttemptId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
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
      <View className="w-40 items-end gap-4">
        <InstanceIcon key={account.serverUrl} serverUrl={account.serverUrl} />
        <Text
          className="text-right text-base font-semibold text-ink-light dark:text-ink-dark"
          numberOfLines={1}
        >
          {account.displayName}
        </Text>
        <Text
          className="text-right text-base text-muted-light dark:text-muted-dark"
          numberOfLines={2}
        >
          {nextcloudInstanceLabel(account.serverUrl)}
        </Text>
        {accountVerification.isFetching ? (
          <Text className="text-right text-base text-muted-light dark:text-muted-dark">
            Checking account…
          </Text>
        ) : accountVerification.error ? (
          <>
            <Text className="text-right text-base text-red-700 dark:text-red-300">
              {accountVerification.error.message}
            </Text>
            <Pressable
              accessibilityLabel="Retry account check"
              accessibilityRole="button"
              className="border border-accent p-4 disabled:opacity-50"
              onPress={() => void accountVerification.refetch()}
            >
              <Text className="text-base text-ink-light dark:text-ink-dark">
                Retry account check
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-4 border border-accent p-4">
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
          <Pressable
            accessibilityLabel="Connect with app password"
            accessibilityRole="button"
            className="border border-accent p-4 disabled:opacity-50"
            disabled={busy}
            onPress={() => void connectManual()}
          >
            <Text className="text-base text-ink-light dark:text-ink-dark">
              Connect with app password
            </Text>
          </Pressable>
        </>
      ) : loginAttemptId ? (
        <>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Finish signing in in your browser. This screen will update automatically.
          </Text>
          <Pressable
            accessibilityLabel="Cancel browser login"
            accessibilityRole="button"
            className="border border-accent p-4 disabled:opacity-50"
            onPress={() => void cancelBrowserLogin()}
          >
            <Text className="text-base text-ink-light dark:text-ink-dark">
              Cancel browser login
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable
            accessibilityLabel="Continue in browser"
            accessibilityRole="button"
            className="border border-accent p-4 disabled:opacity-50"
            disabled={busy}
            onPress={() => void startBrowserLogin()}
          >
            <Text className="text-base text-ink-light dark:text-ink-dark">
              Continue in browser
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Use app credentials instead"
            accessibilityRole="button"
            className="p-4 disabled:opacity-50"
            disabled={busy}
            onPress={() => setShowManual(true)}
          >
            <Text className="text-base text-muted-light dark:text-muted-dark">
              Use app credentials instead
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
