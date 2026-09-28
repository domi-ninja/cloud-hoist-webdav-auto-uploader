import { useCallback, useEffect, useState } from "react";
import { Linking, Text } from "react-native";

import webDavUploadEngine, {
  type AccountHealth,
  type EngineError,
} from "../../../modules/webdav-upload-engine";
import { ActionButton, FormField, LoadingState, Panel } from "@/components/ui";
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
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await pollLogin(); }
      catch { if (active) setMessage("The account check failed. You can retry signing in."); }
      finally { if (active) timer = setTimeout(() => void poll(), 2_000); }
    };
    timer = setTimeout(() => void poll(), 2_000);
    return () => { active = false; clearTimeout(timer); };
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
    const result = await webDavUploadEngine.connectManual({
      serverUrl,
      username,
      appPassword: password,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(errorText(result.error));
    } else setAppPassword("");
  };

  if (account.status === "connected") {
    return <ConnectedAccountButton account={account} />;
  }

  return (
    <Panel>
      <Text
        accessibilityRole="header"
        className="text-base font-semibold text-ink-light dark:text-ink-dark"
      >
        Connect Nextcloud
      </Text>
      {busy ? <LoadingState label="Checking account…" /> : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-base text-red-700 dark:text-red-300"
        >
          {message}
        </Text>
      ) : null}
      <FormField
        label="Nextcloud server URL"
        keyboardType="url"
        autoComplete="url"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        onChangeText={setServerUrl}
        placeholder="https://cloud.example.com"
        value={serverUrl}
      />

      {showManual ? (
        <>
          <FormField
            label="Nextcloud username"
            autoComplete="username"
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
            onSubmitEditing={() => void connectManual()}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setAppPassword}
            placeholder="App password"
            secureTextEntry
            value={appPassword}
          />
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Use a Nextcloud app password, never your main account password.
          </Text>
          <ActionButton
            disabled={busy}
            loading={busy}
            icon="login"
            label="Connect with app password"
            onPress={() => void connectManual()}
            tone="primary"
          />
          <ActionButton
            disabled={busy}
            label="Use browser login"
            icon="web"
            onPress={() => setShowManual(false)}
          />
        </>
      ) : loginAttemptId ? (
        <>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Finish signing in in your browser. This screen will update
            automatically.
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
