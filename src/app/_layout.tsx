import "../../global.css";

import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { EngineQueryProvider } from "@/lib/engine-query";

export default function RootLayout() {
  return (
    <EngineQueryProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#4f7d45",
          tabBarLabelStyle: { fontSize: 14 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Sources" }} />
        <Tabs.Screen name="activity" options={{ title: "Activity" }} />
        <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      </Tabs>
      <StatusBar style="auto" />
    </EngineQueryProvider>
  );
}
