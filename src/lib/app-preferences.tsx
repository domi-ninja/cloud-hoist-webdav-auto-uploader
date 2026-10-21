import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

import { project } from "@/config/project";
import { remotePathSegmentsSchema } from "../../modules/webdav-upload-engine/src/WebDavUploadEngine.types";

export { formatRemoteRoot } from "./app-preferences-state";

const STORAGE_KEY = "app-preferences";
const defaultRemoteRootPath: string[] = [project.defaultRemoteFolder];

type AppPreferences = { remoteRootPath: string[]; hiddenMediaFolders: string[] };
type AppPreferencesContextValue = AppPreferences & {
  setRemoteRootPath: (path: string[]) => Promise<void>;
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
      ? { remoteRootPath: remoteRootPath.data.length === 1 && remoteRootPath.data[0] === "Cloud Hoist"
          ? defaultRemoteRootPath : remoteRootPath.data, hiddenMediaFolders }
      : { remoteRootPath: defaultRemoteRootPath, hiddenMediaFolders: [] };
  } catch {
    return { remoteRootPath: defaultRemoteRootPath, hiddenMediaFolders: [] };
  }
}

export function AppPreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<AppPreferences>();

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        setPreferences(readPreferences(value));
      })
      .catch(() => {
        setPreferences({ remoteRootPath: defaultRemoteRootPath, hiddenMediaFolders: [] });
      });
  }, []);

  const setRemoteRootPath = async (remoteRootPath: string[]) => {
    const next = { ...preferences!, remoteRootPath };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPreferences(next);
  };

  const setHiddenMediaFolders = async (hiddenMediaFolders: string[]) => {
    const next = { ...preferences!, hiddenMediaFolders };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPreferences(next);
  };

  if (!preferences) return null;

  return (
    <AppPreferencesContext.Provider
      value={{ ...preferences, setRemoteRootPath, setHiddenMediaFolders }}
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
