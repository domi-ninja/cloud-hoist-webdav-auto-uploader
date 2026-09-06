import { useCallback, useEffect, useState } from "react";
import { Linking, Text, TextInput } from "react-native";

import webDavUploadEngine, {
  type AccountHealth,
  type EngineError,
} from "../../../modules/webdav-upload-engine";
import { ActionButton, Panel } from "@/components/ui";
import { ConnectedAccountButton } from "./ConnectedAccountButton";

type AccountConnectionProps = {
  account: AccountHealth;
};

function errorText(error: EngineError) {
  return error.message;
}

export function AccountConnection({ account }: AccountConnectionProps) {
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [loginAttemptId, setLoginAttemptId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

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
    return <ConnectedAccountButton account={account} />;
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
        className="border border-accent p-2 text-base text-ink-light dark:text-ink-dark"
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
            className="border border-accent p-2 text-base text-ink-light dark:text-ink-dark"
            editable={!busy}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#737373"
            value={username}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="border border-accent p-2 text-base text-ink-light dark:text-ink-dark"
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
