import { Stack } from "expo-router";

import { fonts, useTheme } from "@/lib/theme";

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
      <Stack.Screen name="index" options={{ title: "My registries", headerLargeTitle: true }} />
      <Stack.Screen name="registry/[id]" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
      <Stack.Screen name="gift-ideas" options={{ title: "Gift ideas", headerBackButtonDisplayMode: "minimal" }} />
    </Stack>
  );
}
