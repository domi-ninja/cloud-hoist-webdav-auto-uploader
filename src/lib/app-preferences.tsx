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

type AppPreferences = { remoteRootPath: string[] };
type AppPreferencesContextValue = AppPreferences & {
  setRemoteRootPath: (path: string[]) => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(
  null,
);

function readPreferences(value: string | null): AppPreferences {
  if (!value) return { remoteRootPath: defaultRemoteRootPath };
  try {
    const parsed = JSON.parse(value) as { remoteRootPath?: unknown };
    const remoteRootPath = remotePathSegmentsSchema.safeParse(
      parsed.remoteRootPath,
    );
    return remoteRootPath.success
      ? { remoteRootPath: remoteRootPath.data }
      : { remoteRootPath: defaultRemoteRootPath };
  } catch {
    return { remoteRootPath: defaultRemoteRootPath };
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
        setPreferences({ remoteRootPath: defaultRemoteRootPath });
      });
  }, []);

  const setRemoteRootPath = async (remoteRootPath: string[]) => {
    const next = { remoteRootPath };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPreferences(next);
  };

  if (!preferences) return null;

  return (
    <AppPreferencesContext.Provider
      value={{ ...preferences, setRemoteRootPath }}
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
