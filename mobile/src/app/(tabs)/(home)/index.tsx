import { router, Stack } from "expo-router";
import { FlatList, RefreshControl, View } from "react-native";

import { GiftIdeasCard } from "@/components/gift-ideas-card";
import { RegistryCard } from "@/components/registry-card";
import { Button, EmptyState, ErrorState, IconButton, LoadingState, Text } from "@/components/ui";
import { errorMessage, useGiftIdeas, useRegistries } from "@/lib/data";
import { spacing, useTheme } from "@/lib/theme";
import type { RegistrySummary } from "@/lib/types";

/** A registry, or the owner's gift ideas, shown as one more list after their own registries. */
type Row = { kind: "registry"; registry: RegistrySummary } | { kind: "ideas" };

function openGiftIdeas() {
  router.push("/gift-ideas");
}

export default function RegistriesScreen() {
  const theme = useTheme();
  const registries = useRegistries();
  const ideas = useGiftIdeas();
  // The owner's own lists, then their gift ideas, then the ones they help
  // manage under "Shared with you", as on the website's dashboard.
  const all = registries.data ?? [];
  const owned = all.filter((r) => r.role === "owner");
  const shared = all.filter((r) => r.role !== "owner");
  const rows: Row[] =
    all.length === 0
      ? []
      : [
          ...owned.map((registry) => ({ kind: "registry" as const, registry })),
          { kind: "ideas" as const },
          ...shared.map((registry) => ({ kind: "registry" as const, registry })),
        ];
  const firstShared = shared.length > 0 ? owned.length + 1 : -1;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton icon="add" accessibilityLabel="New registry" onPress={() => router.push("/new-registry")} />
          ),
        }}
      />
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === "ideas" ? "gift-ideas" : row.registry.id)}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={registries.isRefetching}
            onRefresh={() => {
              registries.refetch();
              ideas.refetch();
            }}
            tintColor={theme.tint}
          />
        }
        ListHeaderComponent={
          rows.length > 0 ? (
            <Text variant="subhead" tone="secondary" style={{ marginBottom: spacing.xs }}>
              Share a product to Regibee from any store's app to add it here.
            </Text>
          ) : undefined
        }
        renderItem={({ item: row, index }) => (
          <>
            {index === firstShared ? (
              <View style={{ marginTop: index > 0 ? spacing.lg : 0, marginBottom: spacing.sm, gap: 2 }}>
                <Text variant="headline">Shared with you</Text>
                <Text variant="footnote" tone="tertiary">
                  Registries you&apos;ve been invited to manage
                </Text>
              </View>
            ) : null}
            {row.kind === "ideas" ? (
              <GiftIdeasCard ideas={ideas.data ?? []} onPress={openGiftIdeas} />
            ) : (
              <RegistryCard
                registry={row.registry}
                onPress={() => router.push({ pathname: "/registry/[id]", params: { id: row.registry.id } })}
              />
            )}
          </>
        )}
        ListEmptyComponent={
          registries.isPending ? (
            <LoadingState />
          ) : registries.isError ? (
            <ErrorState message={errorMessage(registries.error)} onRetry={() => registries.refetch()} />
          ) : (
            <View style={{ flex: 1, gap: spacing.md }}>
              <EmptyState
                icon="gift"
                title="No registries yet"
                message="Create your first registry to start adding items."
                action={
                  <View style={{ width: "100%", maxWidth: 320 }}>
                    <Button title="Create a registry" icon="add" onPress={() => router.push("/new-registry")} />
                  </View>
                }
              />
              <GiftIdeasCard ideas={ideas.data ?? []} onPress={openGiftIdeas} />
            </View>
          )
        }
      />
    </>
  );
}
