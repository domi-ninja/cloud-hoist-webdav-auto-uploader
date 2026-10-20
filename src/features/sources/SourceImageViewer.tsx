import { useState } from "react";
import { FlatList, Image, Modal, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SourcePreview } from "../../../modules/webdav-upload-engine";
import { ActionButton, IconAction, LoadingState } from "@/components/ui";

type PreviewFile = SourcePreview["files"][number];

export function SourceImageViewer({ files, initialIndex, hasMore, loading, error, onLoadMore, onClose }: {
  files: PreviewFile[];
  initialIndex: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  onLoadMore: () => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
        <View className="flex-row items-center gap-2 p-2">
          <IconAction icon="close" label="Close image viewer" onPress={onClose} />
          <Text numberOfLines={2} className="flex-1 text-base text-ink-light dark:text-ink-dark">{files[index]?.fileName}</Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">{index + 1}/{files.length}{hasMore ? "+" : ""}</Text>
        </View>
        <FlatList
          accessibilityLabel="Folder images"
          horizontal
          pagingEnabled
          data={files}
          initialScrollIndex={initialIndex}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          keyExtractor={(file) => file.localUri}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / width);
            setIndex(next);
            if (next >= files.length - 3 && hasMore && !error) onLoadMore();
          }}
          onEndReached={() => { if (hasMore && !error) onLoadMore(); }}
          onEndReachedThreshold={2}
          renderItem={({ item }) => (
            <Image accessibilityLabel={item.fileName} style={{ width, height: "100%" }}
              source={{ uri: item.localUri }} resizeMode="contain" resizeMethod="resize" />
          )}
        />
        {loading ? <LoadingState label="Loading more images…" /> : null}
        {error ? <ActionButton icon="reload" label="Retry loading images" onPress={onLoadMore} /> : null}
      </SafeAreaView>
    </Modal>
  );
}
