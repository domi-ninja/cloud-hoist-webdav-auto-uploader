import { Text, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";

export function ActiveUpload({ fileName }: { fileName: string }) {
  return (
    <View className="flex-row items-center gap-2" accessible accessibilityLabel={`Uploading ${fileName}`} accessibilityState={{ busy: true }}>
      <ActivityIndicator size={18} />
      <Text numberOfLines={1} ellipsizeMode="tail" className="min-w-0 flex-1 text-base text-muted-light dark:text-muted-dark">{fileName}</Text>
    </View>
  );
}
