// "Add to list…" and "Remove from list…" for the items chosen on the Saved
// tab, as the website's selection bar does them (src/components/saved-items.tsx).

import { router, Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { Alert, Platform, ScrollView } from "react-native";

import { NavRow } from "@/components/nav-row";
import { Divider, haptic, IconButton, Section, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { listKind, usePlaceItems, useSavedItems } from "@/lib/saved-data";
import { spacing, useTheme } from "@/lib/theme";

export default function PlaceItemsScreen() {
  const { mode, items } = useLocalSearchParams<{ mode: "add" | "remove"; items: string }>();
  const theme = useTheme();
  const saved = useSavedItems();
  const place = usePlaceItems();
  const itemIds = (items ?? "").split(",").filter(Boolean);
  const chosen = (saved.data?.items ?? []).filter((i) => itemIds.includes(i.id));
  const adding = mode === "add";

  function choose(listId: string, title: string) {
    const ids = chosen.filter((i) => (adding ? !i.listIds.includes(listId) : i.listIds.includes(listId))).map((i) => i.id);
    if (ids.length === 0) {
      Alert.alert(adding ? "Already there" : "Not on that list", adding ? "All of them are on it." : "None of them are on it.");
      return;
    }
    const deleting = adding ? [] : chosen.filter((i) => ids.includes(i.id) && i.listIds.length === 1);
    const run = () =>
      place.mutate(
        { itemIds: ids, listId, on: adding },
        {
          onSuccess: () => {
            haptic("success");
            router.back();
          },
          onError: (e) => Alert.alert("That didn't work", errorMessage(e)),
        }
      );
    if (deleting.length > 0) {
      Alert.alert(
        deleting.length === 1 ? "Delete an item?" : `Delete ${deleting.length} items?`,
        `${deleting.length === 1 ? `“${deleting[0].title}” is` : "Some of them are"} only on ${title}, so taking ${
          deleting.length === 1 ? "it" : "them"
        } off deletes ${deleting.length === 1 ? "it" : "them"}, with any gifts on ${deleting.length === 1 ? "it" : "them"}.`,
        [
          { text: "Keep them", style: "cancel" },
          { text: "Remove and delete", style: "destructive", onPress: run },
        ]
      );
      return;
    }
    run();
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen
        options={{
          title: adding ? "Add to list" : "Remove from list",
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => router.back()} />
              : undefined,
        }}
      />
      <Text variant="subhead" tone="secondary">
        {chosen.length === 1 ? "1 item" : `${chosen.length} items`}
        {adding ? ". Which list should they go on?" : ". Which list should they come off?"}
      </Text>
      <Section>
        {(saved.data?.lists ?? []).map((list, index) => {
          const already = chosen.filter((i) => i.listIds.includes(list.id)).length;
          const detail = adding
            ? already === chosen.length
              ? chosen.length === 1
                ? "It's on this list"
                : "They're all on this list"
              : listKind(list)
            : already === 0
              ? "None are on it"
              : listKind(list);
          return (
            <React.Fragment key={list.id}>
              {index > 0 ? <Divider inset={52} /> : null}
              <NavRow icon="list" label={list.title} detail={detail} onPress={() => choose(list.id, list.title)} />
            </React.Fragment>
          );
        })}
      </Section>
    </ScrollView>
  );
}
