import { useState } from "react";
import { Image, View } from "react-native";
import { Icon } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import webDavUploadEngine from "../../modules/webdav-upload-engine";

/** Video frames remain in memory; the original media is never copied into app storage. */
export function MediaThumbnail({ uri, mimeType, size, version }: {
  uri?: string | null;
  mimeType?: string | null;
  size: number;
  version?: string | null;
}) {
  const video = mimeType?.startsWith("video/");
  const image = mimeType?.startsWith("image/");
  const [failedUri, setFailedUri] = useState<string>();
  const frame = useQuery({
    queryKey: ["local-video-frame", uri, version],
    enabled: Boolean(video && uri),
    queryFn: async () => {
      const result = await webDavUploadEngine.getLocalVideoThumbnail(uri!);
      return result.ok ? result.value : null;
    },
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  });
  const source = video ? frame.data : image ? uri : null;
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    {source && source !== failedUri ? <Image accessible={false} style={{ width: size, height: size }}
      source={{ uri: source }} resizeMode="cover" resizeMethod="resize" onError={() => setFailedUri(source)} />
      : <Icon source={video ? "video-outline" : mimeType?.startsWith("audio/") ? "music-note" : "file-outline"} size={32} />}
    {video && source ? <View className="absolute bottom-1 left-1 rounded bg-black/60"><Icon source="play" color="white" size={24} /></View> : null}
  </View>;
}
