import { router, Stack } from "expo-router";
import { FlatList, RefreshControl, View } from "react-native";

import { RegistryCard } from "@/components/registry-card";
import { Button, EmptyState, ErrorState, IconButton, LoadingState, Text } from "@/components/ui";
import { errorMessage, useRegistries } from "@/lib/data";
import { spacing, useTheme } from "@/lib/theme";

export default function RegistriesScreen() {
  const theme = useTheme();
  const registries = useRegistries();
  // The owner's own lists, then the ones they help manage under "Shared with
  // you", as on the website's dashboard.
  const all = registries.data ?? [];
  const list = [...all.filter((r) => r.role === "owner"), ...all.filter((r) => r.role !== "owner")];
  const firstShared = list.findIndex((r) => r.role !== "owner");

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
        data={list}
        keyExtractor={(r) => r.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={registries.isRefetching}
            onRefresh={() => {
              registries.refetch();
            }}
            tintColor={theme.tint}
          />
        }
        ListHeaderComponent={
          registries.data && registries.data.length > 0 ? (
            <Text variant="subhead" tone="secondary" style={{ marginBottom: spacing.xs }}>
              Share a product to Regibee from any store's app to add it here.
            </Text>
          ) : undefined
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
              onPress={() => router.push({ pathname: "/registry/[id]", params: { id: item.id } })}
            />
          </>
        )}
        ListEmptyComponent={
          registries.isPending ? (
            <LoadingState />
          ) : registries.isError ? (
            <ErrorState message={errorMessage(registries.error)} onRetry={() => registries.refetch()} />
          ) : (
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
          )
        }
      />
    </>
  );
}
