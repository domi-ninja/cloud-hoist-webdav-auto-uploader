import { Alert } from "react-native";
import webDavUploadEngine from "../../../modules/webdav-upload-engine";

/** Explain the background notification before opening Android's permission prompt. */
export async function requestBackupNotifications() {
  const permission = await webDavUploadEngine.getNotificationPermission();
  if (!permission.ok || permission.value.granted || !permission.value.canAskAgain) return;
  const continueToPermission = await new Promise<boolean>((resolve) => {
    Alert.alert(
      "Keep track of background uploads",
      "Android uses an ongoing notification for long uploads in the background. Allow notifications to see backup progress and pause uploads while the app is closed.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
  if (continueToPermission) await webDavUploadEngine.requestNotificationPermission();
}
