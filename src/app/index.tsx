import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";

import { project } from "@/config/project";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
      <View className="flex-1 justify-between gap-4 p-4">
        <View className="gap-4">
          <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">
            {project.displayName}
          </Text>
          <Text className="text-base text-muted-light dark:text-muted-dark">
            Automatic uploads for {project.supportedServer} are being built here.
          </Text>
        </View>

        <View className="border border-accent p-4">
          <Text className="text-base text-ink-light dark:text-ink-dark">
            Android bootstrap ready
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
