import { Stack } from "expo-router";

import { fonts, largeTitleOptions, useTheme } from "@/lib/theme";

export default function HomeLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.tint,
        headerTitleStyle: { fontFamily: fonts.displayMedium, color: theme.text },
        headerLargeTitleStyle: { fontFamily: fonts.display, color: theme.text },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "My registries", ...largeTitleOptions }} />
      <Stack.Screen name="registry/[id]/index" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
      <Stack.Screen name="registry/[id]/settings" options={{ title: "Settings", headerBackButtonDisplayMode: "minimal" }} />
      <Stack.Screen name="registry/[id]/checklist" options={{ title: "Registry Checklist", headerBackButtonDisplayMode: "minimal" }} />
      <Stack.Screen name="registry/[id]/suggestions" options={{ title: "Suggestions Inbox", headerBackButtonDisplayMode: "minimal" }} />
      <Stack.Screen name="registry/[id]/perks" options={{ title: "Store perks", headerBackButtonDisplayMode: "minimal" }} />
    </Stack>
  );
}
