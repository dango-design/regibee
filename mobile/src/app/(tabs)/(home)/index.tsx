import { router, Stack } from "expo-router";
import { RefreshControl, ScrollView, View } from "react-native";

import { ComingUp } from "@/components/home/coming-up";
import { HomeNote } from "@/components/home/home-note";
import { HomeSection } from "@/components/home/home-section";
import { ListCoverCard } from "@/components/home/list-cover-card";
import { PlayUpdateNotice } from "@/components/play-update-notice";
import { Button, EmptyState, ErrorState, IconButton, LoadingState, Text } from "@/components/ui";
import { errorMessage, useDashboard } from "@/lib/data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { spacing, useTheme } from "@/lib/theme";
import type { RegistrySummary } from "@/lib/types";

// The home tab. It shows the website's My registries tab
// (src/app/(protected)/dashboard/(tabs)/(overview)/page.tsx), from the same
// loader, as a stack of sections (HomeSection): first what's waiting on the
// person, then their events, then their lists. New kinds of updates can go
// in as more sections.
export default function HomeScreen() {
  const theme = useTheme();
  const dashboard = useDashboard();
  const pull = usePullToRefresh(dashboard.refetch);
  const data = dashboard.data;
  const hasLists = data ? data.owned.length + data.shared.length > 0 : false;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton icon="add" accessibilityLabel="Start something new" onPress={() => router.push("/new")} />
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.xl, flexGrow: 1 }}
        refreshControl={<RefreshControl {...pull} tintColor={theme.tint} />}
      >
        {/* A newer build on Google Play. Android only. */}
        <PlayUpdateNotice />

        {!data ? (
          dashboard.isPending ? (
            <LoadingState />
          ) : (
            <ErrorState message={errorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />
          )
        ) : (
          <>
            {/* What's waiting on the person. These show with no lists too:
                someone with no list can still have follow requests. */}
            {data.giftsThisWeek > 0 || data.followRequestCount > 0 || data.showProfilePrompt ? (
              <View style={{ gap: spacing.md }}>
                {data.giftsThisWeek > 0 ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.xs }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success }} />
                    <Text variant="subhead" tone="secondary">
                      {data.giftsThisWeek === 1 ? "1 gift reserved this week" : `${data.giftsThisWeek} gifts reserved this week`}
                    </Text>
                  </View>
                ) : null}
                {data.followRequestCount > 0 ? (
                  <HomeNote
                    icon="personAdd"
                    tint="blushSoft"
                    text={
                      data.followRequestCount === 1
                        ? "1 person wants to follow you"
                        : `${data.followRequestCount} people want to follow you`
                    }
                    action="Review"
                    onPress={() => router.push("/account/follows")}
                  />
                ) : null}
                {data.showProfilePrompt ? (
                  <HomeNote
                    icon="link"
                    tint="tealSoft"
                    text="Give friends one link to all your registries"
                    action="Choose"
                    onPress={() => router.push("/account/profile")}
                  />
                ) : null}
              </View>
            ) : null}

            <ComingUp events={data.upcomingEvents ?? []} today={data.today} />

            {data.owned.length > 0 ? (
              <HomeSection title="Your lists">
                <ListCards lists={data.owned} today={data.today} />
              </HomeSection>
            ) : null}

            {data.shared.length > 0 ? (
              <HomeSection title="Shared with you">
                <ListCards lists={data.shared} today={data.today} />
              </HomeSection>
            ) : null}

            {!hasLists ? (
              <EmptyState
                icon="gift"
                title="No registries yet"
                action={
                  <View style={{ width: "100%", maxWidth: 320 }}>
                    <Button title="Start something new" icon="add" onPress={() => router.push("/new")} />
                  </View>
                }
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}

function ListCards({ lists, today }: { lists: RegistrySummary[]; today: string }) {
  return (
    <View style={{ gap: spacing.md }}>
      {lists.map((registry) => (
        <ListCoverCard
          key={registry.id}
          registry={registry}
          today={today}
          onPress={() => router.push({ pathname: "/registry/[id]", params: { id: registry.id } })}
        />
      ))}
    </View>
  );
}
