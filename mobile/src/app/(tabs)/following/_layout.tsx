import { Stack } from "expo-router";

import { fonts, useTheme } from "@/lib/theme";

export default function FollowingLayout() {
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
      <Stack.Screen name="index" options={{ title: "Following", headerLargeTitle: true }} />
    </Stack>
  );
}
