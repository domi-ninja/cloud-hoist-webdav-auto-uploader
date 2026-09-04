import "../../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { EngineQueryProvider } from "@/lib/engine-query";

export default function RootLayout() {
  return (
    <EngineQueryProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </EngineQueryProvider>
  );
}
