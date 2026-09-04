import "../../global.css";

import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { EngineQueryProvider } from "@/lib/engine-query";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";

  return (
    <EngineQueryProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#4f7d45",
          tabBarInactiveTintColor: "#62665d",
          tabBarIcon: () => null,
          tabBarIconStyle: { display: "none" },
          tabBarLabelStyle: { fontSize: 16 },
          tabBarStyle: {
            backgroundColor: dark ? "#242720" : "#e6e8e1",
            borderTopColor: dark ? "#aeb2a8" : "#62665d",
          },
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
