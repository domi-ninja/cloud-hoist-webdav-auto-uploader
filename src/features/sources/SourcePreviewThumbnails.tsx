import { useRef, useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { Icon } from "react-native-paper";

import webDavUploadEngine, {
  type SourcePreview,
  type SourceSelection,
} from "../../../modules/webdav-upload-engine";
import { SourceImageViewer } from "./SourceImageViewer";
import { ActionButton, LoadingState } from "@/components/ui";

export function SourcePreviewThumbnails({
  preview,
  selection,
  rows = 2,
}: {
  preview: SourcePreview;
  selection: SourceSelection;
  rows?: 1 | 2;
}) {
  const [viewingImage, setViewingImage] = useState<string>();
  const [files, setFiles] = useState(preview.files);
  const [nextOffset, setNextOffset] = useState(preview.nextOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetching = useRef(false);

  const loadMore = async () => {
    if (nextOffset == null || fetching.current) return;
    fetching.current = true;
    setLoading(true);
    setError(false);
    try {
      const result = await webDavUploadEngine.previewSource(selection, nextOffset);
      if (!result.ok) {
        setError(true);
        return;
      }
      setFiles((current) => [...current, ...result.value.files]);
      setNextOffset(result.value.nextOffset);
    } catch {
      setError(true);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  };

  const columns = Array.from(
    { length: Math.ceil(files.length / rows) },
    (_, index) => files.slice(index * rows, index * rows + rows),
  );
  if (!files.length) return null;

  const images = files.filter((file) => file.mimeType?.startsWith("image/"));
  return (
    <>
    <FlatList
      accessibilityLabel="Files in this backup folder"
      horizontal
      style={{ height: rows * 96 + (rows - 1) * 8 }}
      data={columns}
      keyExtractor={(column) => column[0].localUri}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={3}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (!error) void loadMore();
      }}
      renderItem={({ item: column }) => (
        <View style={{ gap: 8, marginRight: 8 }}>
          {column.map((file) => (
            <View
              key={file.localUri}
              className="items-center justify-center overflow-hidden bg-canvas-light dark:bg-canvas-dark"
              style={{ width: 96, height: 96 }}
            >
              {file.mimeType?.startsWith("image/") ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Enlarge ${file.fileName}`}
                  onPress={() => setViewingImage(file.localUri)}>
                <Image
                  accessible={false}
                  style={{ width: 96, height: 96 }}
                  resizeMode="cover"
                  resizeMethod="resize"
                  source={{ uri: file.localUri }}
                />
                </Pressable>
              ) : (
                <>
                  <Icon source="file-outline" size={32} />
                  <Text numberOfLines={1} className="text-base text-muted-light dark:text-muted-dark">
                    {file.fileName}
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>
      )}
      ListFooterComponent={
        loading ? <LoadingState label="Loading files…" /> : error ? (
          <ActionButton icon="reload" label="Retry loading files" onPress={() => void loadMore()} />
        ) : null
      }
    />
    {viewingImage ? (
      <SourceImageViewer files={images} initialIndex={Math.max(0, images.findIndex((file) => file.localUri === viewingImage))}
        hasMore={nextOffset != null} loading={loading} error={error}
        onLoadMore={() => void loadMore()} onClose={() => setViewingImage(undefined)} />
    ) : null}
    </>
  );
}
