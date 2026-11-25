import { router, Stack } from "expo-router";
import { FlatList, RefreshControl, View } from "react-native";

import { Notice } from "@/components/notice";
import { PlayUpdateNotice } from "@/components/play-update-notice";
import { RegistryCard } from "@/components/registry-card";
import { UpcomingEvents } from "@/components/upcoming-events";
import { Button, EmptyState, ErrorState, IconButton, LoadingState, Text } from "@/components/ui";
import { errorMessage, useDashboard } from "@/lib/data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { spacing, useTheme } from "@/lib/theme";
import type { RegistrySummary } from "@/lib/types";

// The website's My registries tab (src/app/(protected)/dashboard/(tabs)/(overview)/page.tsx),
// from the same loader.
export default function RegistriesScreen() {
  const theme = useTheme();
  const dashboard = useDashboard();
  const pull = usePullToRefresh(dashboard.refetch);
  const data = dashboard.data;
  // The owner's own lists, then the ones they help manage under "Shared with
  // you", as on the website's dashboard.
  const list: RegistrySummary[] = data ? [...data.owned, ...data.shared] : [];
  const firstShared = data ? data.owned.length : -1;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton icon="add" accessibilityLabel="Start something new" onPress={() => router.push("/new")} />
          ),
        }}
      />
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            {...pull}
            tintColor={theme.tint}
          />
        }
        ListHeaderComponent={
          <>
            {/* A newer build on Google Play. Android only. */}
            <PlayUpdateNotice />
            {/* The notices and "Coming up" show with no lists too, as on the
                website: someone with no list can still have follow requests
                and events. */}
            {data ? (
              <View style={{ gap: spacing.md, marginBottom: spacing.xs }}>
                {list.length > 0 ? (
                  <Text variant="subhead" tone="secondary">
                    {data.giftsThisWeek > 0
                      ? data.giftsThisWeek === 1
                        ? "1 gift reserved this week"
                        : `${data.giftsThisWeek} gifts reserved this week`
                      : "Manage your registries and track gifts"}
                  </Text>
                ) : null}
                {data.followRequestCount > 0 ? (
                  <Notice
                    icon="personAdd"
                    tone="accent"
                    title={
                      data.followRequestCount === 1
                        ? "1 person wants to follow you"
                        : `${data.followRequestCount} people want to follow you`
                    }
                    message="People you approve can see the registries you show to followers on your profile."
                    action={{ title: "Review requests", onPress: () => router.push("/account/follows") }}
                  />
                ) : null}
                {data.showProfilePrompt ? (
                  <Notice
                    icon="link"
                    tone="tint"
                    title="Give friends one link to all your registries"
                    message="Your profile shows only the registries you choose. Friends can follow it to see new ones."
                    action={{ title: "Choose registries", onPress: () => router.push("/account/profile") }}
                  />
                ) : null}
                <UpcomingEvents events={data.upcomingEvents ?? []} today={data.today} />
              </View>
            ) : null}
          </>
        }
        renderItem={({ item, index }) => (
          <>
            {index === firstShared ? (
              <View style={{ marginTop: index > 0 ? spacing.lg : 0, marginBottom: spacing.sm, gap: 2 }}>
                <Text variant="headline">Shared with you</Text>
                <Text variant="footnote" tone="tertiary">
                  Registries you&apos;ve been invited to manage
                </Text>
              </View>
            ) : null}
            <RegistryCard
              registry={item}
              today={data?.today}
              onPress={() => router.push({ pathname: "/registry/[id]", params: { id: item.id } })}
            />
          </>
        )}
        ListEmptyComponent={
          dashboard.isPending ? (
            <LoadingState />
          ) : dashboard.isError ? (
            <ErrorState message={errorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />
          ) : (
            <EmptyState
              icon="gift"
              title="No registries yet"
              message="Create your first registry to start adding items."
              action={
                <View style={{ width: "100%", maxWidth: 320 }}>
                  <Button title="Start something new" icon="add" onPress={() => router.push("/new")} />
                </View>
              }
            />
          )
        }
      />
    </>
  );
}
