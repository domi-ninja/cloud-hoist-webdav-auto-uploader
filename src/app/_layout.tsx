import "../../global.css";

import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { EngineQueryProvider } from "@/lib/engine-query";
import { AppPreferencesProvider } from "@/lib/app-preferences";
import { AutomaticUpdatePrompt } from "@/features/updates/AppUpdates";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dark = colorScheme === "dark";
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: dark ? "#aed69f" : "#3f6837",
      onPrimary: dark ? "#183811" : "#ffffff",
      primaryContainer: dark ? "#294f22" : "#d0ebc3",
      onPrimaryContainer: dark ? "#d0ebc3" : "#14380e",
      secondary: dark ? "#bbcbb2" : "#53634c",
      secondaryContainer: dark ? "#354630" : "#d7e8cc",
      onSecondaryContainer: dark ? "#d7e8cc" : "#20351a",
      surface: dark ? "#161714" : "#f4f4f0",
      background: dark ? "#161714" : "#f4f4f0",
      onBackground: dark ? "#f0f1eb" : "#20221e",
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
      <AppPreferencesProvider>
        <EngineQueryProvider>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: theme.colors.primary,
              tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
              tabBarLabelStyle: { fontSize: 16 },
              tabBarAllowFontScaling: true,
              tabBarStyle: {
                height: 56 + insets.bottom + Math.max(0, fontScale - 1) * 20,
                backgroundColor: dark ? "#242720" : "#e6e8e1",
                borderTopColor: dark ? "#42473d" : "#c5cbbf",
              },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: "Backups",
                tabBarAccessibilityLabel: "Backups",
                tabBarIcon: (props) => (
                  <MaterialCommunityIcons
                    {...props}
                    name="folder-sync-outline"
                  />
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
          <AutomaticUpdatePrompt />
          <StatusBar style="auto" />
        </EngineQueryProvider>
      </AppPreferencesProvider>
    </PaperProvider>
  );
}
