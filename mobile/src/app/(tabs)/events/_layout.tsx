import { Stack } from "expo-router";

import { fonts, useTheme } from "@/lib/theme";

export default function EventsLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.tint,
        headerLargeTitleStyle: { fontFamily: fonts.display, color: theme.text },
        headerTitleStyle: { fontFamily: fonts.displayMedium, color: theme.text },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Events", headerLargeTitle: true }} />
      <Stack.Screen name="[eventId]" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
      <Stack.Screen name="group/[groupId]" options={{ title: "Group", headerBackButtonDisplayMode: "minimal" }} />
    </Stack>
  );
}
