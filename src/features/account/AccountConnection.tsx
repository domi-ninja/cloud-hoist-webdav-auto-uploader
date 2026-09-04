import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";

import webDavUploadEngine, {
  type AccountHealth,
  type EngineError,
  type SourcePreview,
  type SourceSelection,
} from "../../../modules/webdav-upload-engine";
import { LocalSourcePicker } from "../sources/LocalSourcePicker";
import { RemoteFolderPicker } from "../sources/RemoteFolderPicker";

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
  const [selectedRemotePath, setSelectedRemotePath] = useState<string[]>();
  const [selectedSource, setSelectedSource] = useState<{
    selection: SourceSelection;
    preview: SourcePreview;
  }>();

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

  const verifyStoredAccount = async () => {
    setBusy(true);
    const result = await webDavUploadEngine.verifyStoredAccount();
    setBusy(false);
    setMessage(result.ok ? "Account verified from encrypted storage." : errorText(result.error));
  };

  if (account.status === "connected") {
    return (
      <View className="gap-4">
        <View className="gap-4 border border-accent p-4">
          <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
            {account.displayName}
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            {account.serverUrl} · DAV user {account.davUserId}
          </Text>
          <Pressable
            accessibilityLabel="Verify stored account"
            accessibilityRole="button"
            className="border border-accent p-4"
            disabled={busy}
            onPress={() => void verifyStoredAccount()}
          >
            <Text className="text-base text-ink-light dark:text-ink-dark">
              Verify stored account
            </Text>
          </Pressable>
          {message ? (
            <Text className="text-base text-muted-light dark:text-muted-dark">
              {message}
            </Text>
          ) : null}
        </View>
        <LocalSourcePicker
          onSelect={(selection, preview) => {
            setSelectedSource({ selection, preview });
            setSelectedRemotePath(undefined);
          }}
        />
        {selectedSource ? (
          <RemoteFolderPicker onSelect={setSelectedRemotePath} />
        ) : null}
        {selectedRemotePath ? (
          <Text className="text-base text-ink-light dark:text-ink-dark">
            Selected: /{selectedRemotePath.join("/")}
          </Text>
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
        <Text className="text-base text-muted-light dark:text-muted-dark">
          Checking account…
        </Text>
      ) : null}
      {message ? (
        <Text className="text-base text-red-700 dark:text-red-300">
          {message}
        </Text>
      ) : null}
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        className="border border-accent p-4 text-base text-ink-light dark:text-ink-dark"
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
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#737373"
            value={username}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            className="border border-accent p-4 text-base text-ink-light dark:text-ink-dark"
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
            className="border border-accent p-4"
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
            className="border border-accent p-4"
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
            className="border border-accent p-4"
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
            className="p-4"
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
