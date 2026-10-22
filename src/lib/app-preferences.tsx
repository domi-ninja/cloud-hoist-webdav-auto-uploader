import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

import webDavUploadEngine from "../../modules/webdav-upload-engine";
import { project } from "@/config/project";
import { remotePathSegmentsSchema } from "../../modules/webdav-upload-engine/src/WebDavUploadEngine.types";

export { formatRemoteRoot } from "./app-preferences-state";

const STORAGE_KEY = "app-preferences";
const defaultRemoteRootPath: string[] = [project.defaultRemoteFolder];

type AppPreferences = { remoteRootPath: string[]; hiddenMediaFolders: string[] };
type AppPreferencesContextValue = AppPreferences & {
  refreshRemoteRoot: () => Promise<void>;
  setHiddenMediaFolders: (folders: string[]) => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(
  null,
);

function readPreferences(value: string | null): AppPreferences {
  if (!value) return { remoteRootPath: defaultRemoteRootPath, hiddenMediaFolders: [] };
  try {
    const parsed = JSON.parse(value) as { remoteRootPath?: unknown; hiddenMediaFolders?: unknown };
    const remoteRootPath = remotePathSegmentsSchema.safeParse(
      parsed.remoteRootPath,
    );
    const hiddenMediaFolders = Array.isArray(parsed.hiddenMediaFolders)
      ? parsed.hiddenMediaFolders.filter((value): value is string => typeof value === "string")
      : [];
    return remoteRootPath.success
      ? { remoteRootPath: remoteRootPath.data, hiddenMediaFolders }
      : { remoteRootPath: defaultRemoteRootPath, hiddenMediaFolders: [] };
  } catch {
    return { remoteRootPath: defaultRemoteRootPath, hiddenMediaFolders: [] };
  }
}

export function AppPreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<AppPreferences>();

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then(async (value) => {
        const saved = readPreferences(value);
        const root = await webDavUploadEngine.getBackupRoot(saved.remoteRootPath);
        setPreferences({ ...saved, remoteRootPath: root.ok ? root.value : saved.remoteRootPath });
      })
      .catch(() => {
        setPreferences({ remoteRootPath: defaultRemoteRootPath, hiddenMediaFolders: [] });
      });
  }, []);

  const refreshRemoteRoot = async () => {
    const root = await webDavUploadEngine.getBackupRoot(defaultRemoteRootPath);
    if (!root.ok) throw new Error(root.error.message);
    setPreferences((previous) => previous ? { ...previous, remoteRootPath: root.value } : previous);
  };

  const setHiddenMediaFolders = async (hiddenMediaFolders: string[]) => {
    const next = { ...preferences!, hiddenMediaFolders };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPreferences(next);
  };

  if (!preferences) return null;

  return (
    <AppPreferencesContext.Provider
      value={{ ...preferences, refreshRemoteRoot, setHiddenMediaFolders }}
    >
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const value = useContext(AppPreferencesContext);
  if (!value) throw new Error("App preferences provider is missing.");
  return value;
}
