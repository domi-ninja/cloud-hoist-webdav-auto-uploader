import { Image, ScrollView, Text, View } from "react-native";
import { Icon } from "react-native-paper";

import type { SourcePreview } from "../../../modules/webdav-upload-engine";

export function SourcePreviewThumbnails({
  files,
}: {
  files: SourcePreview["files"];
}) {
  if (!files.length) return null;

  return (
    <ScrollView
      accessibilityLabel="Files in this backup folder"
      contentContainerClassName="gap-2"
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {files.map((file) => (
        <View
          className="h-16 w-16 items-center justify-center overflow-hidden bg-canvas-light dark:bg-canvas-dark"
          key={`${file.localUri}-${file.fileName}`}
        >
          {file.mimeType?.startsWith("image/") ? (
            <Image
              accessibilityLabel={file.fileName}
              className="h-16 w-16"
              resizeMode="cover"
              resizeMethod="resize"
              source={{ uri: file.localUri }}
            />
          ) : (
            <>
              <Icon source="file-outline" size={24} />
              <Text
                className="text-base text-muted-light dark:text-muted-dark"
                numberOfLines={1}
              >
                {file.fileName}
              </Text>
            </>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
