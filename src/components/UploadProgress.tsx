import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTheme } from "react-native-paper";

import type { EngineSnapshot } from "../../modules/webdav-upload-engine";
import { IconAction } from "./ui";
import { engineStatus, uploadProgress, uploadRemainingTime } from "@/lib/upload-status";

export function UploadProgress({
  snapshot,
  now,
  leadingAction,
  onRescan,
  scanning = false,
}: {
  snapshot: EngineSnapshot;
  now: number;
  leadingAction?: ReactNode;
  onRescan?: () => void;
  scanning?: boolean;
}) {
  const { uploaded, total, fraction } = uploadProgress(snapshot);
  const theme = useTheme();
  const label = `${uploaded}/${total} files uploaded`;
  const remainingTime = uploadRemainingTime(snapshot);

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        {leadingAction}
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Upload progress"
          accessibilityValue={{ min: 0, max: total || 1, now: uploaded, text: label }}
          accessibilityState={{ busy: snapshot.worker.state === "uploading" }}
          className="h-2 flex-1 overflow-hidden rounded"
          style={{ backgroundColor: theme.colors.outlineVariant }}
        >
          <View
            className="h-full"
            style={{ width: `${fraction * 100}%`, backgroundColor: theme.colors.primary }}
          />
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-base font-semibold text-ink-light dark:text-ink-dark">{label}</Text>
        {remainingTime ? <Text className="text-base text-muted-light dark:text-muted-dark">{remainingTime}</Text> : null}
        {onRescan ? <IconAction style={{ margin: 0, width: 40, height: 32 }} hitSlop={8} icon="refresh" label={scanning ? "Scanning…" : "Scan now"} loading={scanning} disabled={scanning} onPress={onRescan} /> : null}
      </View>
      <Text
        accessibilityLiveRegion="polite"
        className="text-base text-muted-light dark:text-muted-dark"
      >
        {engineStatus(snapshot, now)}
      </Text>
    </View>
  );
}
