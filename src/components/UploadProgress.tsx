import { Text, View } from "react-native";
import { useTheme } from "react-native-paper";

import type { EngineSnapshot } from "../../modules/webdav-upload-engine";
import { engineStatus, uploadProgress } from "@/lib/upload-status";

export function UploadProgress({
  snapshot,
  now,
}: {
  snapshot: EngineSnapshot;
  now: number;
}) {
  const { uploaded, total, fraction } = uploadProgress(snapshot);
  const theme = useTheme();
  const label = `${uploaded}/${total} uploaded`;

  return (
    <View className="gap-2">
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Upload progress"
        accessibilityValue={{ min: 0, max: total || 1, now: uploaded, text: label }}
        accessibilityState={{ busy: snapshot.worker.state === "uploading" }}
        className="h-2 overflow-hidden rounded"
        style={{ backgroundColor: theme.colors.outlineVariant }}
      >
        <View
          className="h-full"
          style={{ width: `${fraction * 100}%`, backgroundColor: theme.colors.primary }}
        />
      </View>
      <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
        {label}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        className="text-base text-muted-light dark:text-muted-dark"
      >
        {engineStatus(snapshot, now)}
      </Text>
    </View>
  );
}
