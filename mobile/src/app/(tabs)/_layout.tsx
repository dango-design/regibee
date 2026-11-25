import { NativeTabs } from "expo-router/native-tabs";

import { useDashboard } from "@/lib/data";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const theme = useTheme();
  // Follow requests waiting for an answer. The website shows a dot on the
  // account menu on every page; here the Account tab shows the count. The
  // home screen loads the same data, so this asks the server nothing extra.
  const followRequests = useDashboard().data?.followRequestCount ?? 0;
  return (
    <NativeTabs
      tintColor={theme.tint}
      backgroundColor={theme.background}
      labelStyle={{ selected: { color: theme.tint } }}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Registries</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "gift", selected: "gift.fill" }} md="redeem" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "bookmark", selected: "bookmark.fill" }} md="bookmark" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="events">
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} md="event" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="following">
        <NativeTabs.Trigger.Label>Following</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person.2", selected: "person.2.fill" }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        {/* No text when there are none: expo-router shows any text it's given, even with hidden set. */}
        <NativeTabs.Trigger.Badge hidden={followRequests === 0}>
          {followRequests > 0 ? String(followRequests) : undefined}
        </NativeTabs.Trigger.Badge>
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
