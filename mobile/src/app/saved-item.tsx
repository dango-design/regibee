// One saved item's lists: tick the lists it should be on, as the website's
// "Lists" button on the Saved tab does (src/components/saved-items.tsx).
// Taking it off its last list deletes it.

import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, Platform, ScrollView, View } from "react-native";

import { ItemImage } from "@/components/item-image";
import { Button, EmptyState, haptic, IconButton, Section, SwitchRow, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { listKind, setSavedNotice, storeDomain, usePlaceItems, useSavedItems } from "@/lib/saved-data";
import { radius, spacing, useTheme } from "@/lib/theme";

export default function SavedItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const saved = useSavedItems();
  const place = usePlaceItems();
  const item = saved.data?.items.find((i) => i.id === id);
  const lists = saved.data?.lists ?? [];

  if (!item) {
    return <EmptyState icon="error" title="This item is gone" message="It may have been deleted on another device." />;
  }

  function toggle(listId: string, on: boolean) {
    const title = item!.title;
    const deleting = !on && item!.listIds.length === 1;
    const run = () => {
      haptic();
      setSavedNotice("items", "");
      place.mutate(
        { itemIds: [item!.id], listId, on },
        {
          // The Saved tab says what happened to a deleted item, as the website does.
          onSuccess: () => {
            if (deleting) setSavedNotice("items", `Deleted “${title}”.`);
          },
          onError: (e) => {
            if (deleting) setSavedNotice("items", `“${title}” wasn't deleted. ${errorMessage(e)}`);
            else Alert.alert("That didn't work", errorMessage(e));
          },
        }
      );
    };
    // Taking it off the only list it's on deletes it, so ask first, in the website's words.
    if (deleting) {
      Alert.alert("It's on no other list, so taking it off deletes it.", undefined, [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete it",
          style: "destructive",
          onPress: () => {
            run();
            router.back();
          },
        },
      ]);
      return;
    }
    run();
  }

  const meta = [item.price != null ? formatPrice(item.price) : null, storeDomain(item.externalUrl)].filter(Boolean).join(" · ");

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
      <Stack.Screen
        options={{
          title: "Lists",
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Close" onPress={() => router.back()} />
              : undefined,
        }}
      />
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        <ItemImage uri={item.imageUrl} size={72} rounded={radius.md} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="headline">{item.title}</Text>
          {meta ? (
            <Text variant="subhead" tone="secondary">
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
      {item.externalUrl ? (
        <Button title="Shop" icon="external" variant="secondary" size="medium" onPress={() => WebBrowser.openBrowserAsync(item.externalUrl!)} />
      ) : null}
      <Section title="On your lists" footer="Gifts belong to the item, so a gift reserved through any of its lists shows on all of them.">
        {lists.map((list) => (
          <SwitchRow
            key={list.id}
            label={list.title}
            description={listKind(list)}
            value={item.listIds.includes(list.id)}
            onValueChange={(on) => toggle(list.id, on)}
          />
        ))}
      </Section>
    </ScrollView>
  );
}
