import { useEffect, useState } from "react";
import { AppState, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { ActionButton, Panel } from "@/components/ui";
import webDavUploadEngine from "../../../modules/webdav-upload-engine";

export function BackgroundAccess() {
  const [error, setError] = useState<string>();
  const { data: unrestricted, refetch } = useQuery({
    queryKey: ["background-access"],
    queryFn: webDavUploadEngine.isBackgroundUnrestricted,
    staleTime: 0,
  });

  useEffect(function refreshAfterBatterySettings() {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  if (unrestricted !== false) return null;
  return (
    <Panel>
      <ActionButton icon="battery-outline" label="Allow unrestricted background uploads" onPress={async () => {
        setError(undefined);
        const result = await webDavUploadEngine.openBackgroundSettings();
        if (!result.ok) setError("Battery settings could not be opened.");
      }} />
      {error ? <Text accessibilityLiveRegion="polite" className="text-base text-red-700 dark:text-red-300">{error}</Text> : null}
    </Panel>
  );
}
