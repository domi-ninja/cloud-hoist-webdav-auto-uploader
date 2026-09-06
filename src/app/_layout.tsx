import "../../global.css";

import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { EngineQueryProvider } from "@/lib/engine-query";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: dark ? "#aed69f" : "#3f6837",
      onPrimary: dark ? "#183811" : "#ffffff",
      secondaryContainer: dark ? "#354630" : "#d7e8cc",
      onSecondaryContainer: dark ? "#d7e8cc" : "#20351a",
      surface: dark ? "#161714" : "#f4f4f0",
      surfaceVariant: dark ? "#242720" : "#e6e8e1",
      onSurface: dark ? "#f0f1eb" : "#20221e",
      onSurfaceVariant: dark ? "#aeb2a8" : "#62665d",
    },
  };

  return (
    <PaperProvider
      theme={theme}
      settings={{
        icon: (props) => (
          <MaterialCommunityIcons
            {...props}
            name={props.name as keyof typeof MaterialCommunityIcons.glyphMap}
          />
        ),
      }}
    >
      <EngineQueryProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
            tabBarLabelStyle: { fontSize: 16 },
            tabBarStyle: {
              backgroundColor: dark ? "#242720" : "#e6e8e1",
              borderTopColor: dark ? "#aeb2a8" : "#62665d",
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Sources",
              tabBarAccessibilityLabel: "Sources",
              tabBarIcon: (props) => (
                <MaterialCommunityIcons {...props} name="folder-sync-outline" />
              ),
            }}
          />
          <Tabs.Screen
            name="activity"
            options={{
              title: "Activity",
              tabBarAccessibilityLabel: "Activity",
              tabBarIcon: (props) => (
                <MaterialCommunityIcons {...props} name="transfer" />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: "Settings",
              tabBarAccessibilityLabel: "Settings",
              tabBarIcon: (props) => (
                <MaterialCommunityIcons {...props} name="cog-outline" />
              ),
            }}
          />
        </Tabs>
        <StatusBar style="auto" />
      </EngineQueryProvider>
    </PaperProvider>
  );
}
