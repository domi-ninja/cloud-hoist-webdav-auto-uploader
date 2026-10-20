import { Linking } from "react-native";

import webDavUploadEngine from "../../../modules/webdav-upload-engine";
import { openAppUpdate, updateConfig, type AppRelease } from "./app-update";

export function openUpdate(release: AppRelease) {
  return openAppUpdate(release, updateConfig, {
    openPlayStore: async (androidPackage) => {
      const result = await webDavUploadEngine.openPlayStore(androidPackage);
      return result.ok && result.value;
    },
    // Linking.openURL validates through `this`; passing the method directly loses its receiver.
    openUrl: (url) => Linking.openURL(url),
  });
}
