import { useState } from "react";
import { Image, Text, View } from "react-native";

import { nextcloudInstanceIconUrl } from "./instance-icon";

type InstanceIconProps = {
  serverUrl: string;
  compact?: boolean;
};

export function InstanceIcon({ serverUrl, compact = false }: InstanceIconProps) {
  const [failed, setFailed] = useState(false);
  const size = compact ? "h-8 w-8" : "h-16 w-16";

  if (failed) {
    return (
      <View
        accessibilityLabel="Nextcloud instance icon"
        accessibilityRole="image"
        accessible
        className={`${size} items-center justify-center bg-canvas-light dark:bg-canvas-dark`}
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
      className={`${size} bg-canvas-light dark:bg-canvas-dark`}
      onError={() => setFailed(true)}
      resizeMode="contain"
      source={{ uri: nextcloudInstanceIconUrl(serverUrl) }}
    />
  );
}
