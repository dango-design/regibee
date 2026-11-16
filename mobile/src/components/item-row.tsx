import { Link, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { memo } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";

import { ownerItemStatus } from "@shared/gifts";
import { registryStoreFor, type StoreId } from "@shared/retailers";

import { Icon } from "@/components/icon";
import { ItemImage } from "@/components/item-image";
import { haptic, Pill, Text } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";
import type { Item } from "@/lib/types";

export interface ItemActions {
  toggleMostWanted: (item: Item) => void;
  toggleBought: (item: Item) => void;
  remove: (item: Item) => void;
}

/** The website's item card uses the same tags. */
const TAG_TONE = { "purchased-by-you": "success", gifted: "success", reserved: "tint" } as const;

function openLink(item: Item) {
  if (item.external_url) WebBrowser.openBrowserAsync(item.external_url);
}

/**
 * The website's item card offers "Mark as bought by parent" (or the list's own
 * words) only while the item still needs gifts, and "Mark as unpurchased" once
 * it's marked.
 */
function boughtAction(item: Item, selfPurchaseButton: string) {
  if (item.is_parent_purchased) return "Mark as unpurchased";
  return item.quantity_fulfilled < item.quantity_needed ? selfPurchaseButton : null;
}

/** Long-press options on Android, where there's no native link menu. */
function showActions(item: Item, actions: ItemActions, selfPurchaseButton: string) {
  haptic();
  const bought = boughtAction(item, selfPurchaseButton);
  Alert.alert(item.title, undefined, [
    { text: item.is_essential ? "Remove from most wanted" : "Mark most wanted", onPress: () => actions.toggleMostWanted(item) },
    ...(bought ? [{ text: bought, onPress: () => actions.toggleBought(item) }] : []),
    ...(item.external_url ? [{ text: "Shop", onPress: () => openLink(item) }] : []),
    { text: "Remove item", style: "destructive" as const, onPress: () => actions.remove(item) },
    { text: "Cancel", style: "cancel" as const },
  ]);
}

export const ItemRow = memo(function ItemRow({
  item,
  actions,
  linkedStores,
  selfPurchaseButton,
}: {
  item: Item;
  actions: ItemActions;
  /** The list's "Mark as bought by parent" wording, from copyFor (src/lib/registry-copy.ts). */
  selfPurchaseButton: string;
  /**
   * The stores the owner linked in settings, for baby registries. With them, a
   * link that counts toward a store registry says so, by the guest page's rule,
   * as the website's item card does (src/components/store-registry-line.tsx).
   */
  linkedStores?: StoreId[] | null;
}) {
  const theme = useTheme();
  // What the website's item card says (src/lib/gifts.ts).
  const s = ownerItemStatus(item, item.purchases);
  // Gifts of an item the owner bought go as money, not through the link.
  const registryStore =
    linkedStores && !item.is_parent_purchased ? registryStoreFor(item.external_url, linkedStores) : null;
  const bought = boughtAction(item, selfPurchaseButton);
  const href = { pathname: "/item/[id]", params: { id: item.id } } as const;

  const ios = Platform.OS === "ios";
  const content = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${s.tag ? `, ${s.tag.label}` : ""}${item.price ? `, ${formatPrice(item.price)}` : ""}, ${s.quantity}${registryStore ? `, counts toward your ${registryStore.name} registry` : ""}${item.is_essential ? ", most wanted" : ""}`}
      accessibilityHint="Opens the item to edit it"
      // On iPhone the Link below opens it and adds the long-press menu.
      onPress={ios ? undefined : () => router.push(href)}
      onLongPress={ios ? undefined : () => showActions(item, actions, selfPurchaseButton)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceAlt : theme.surface }]}
    >
      <ItemImage uri={item.image_url} size={64} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
          {item.is_essential ? (
            <View style={{ paddingTop: 2 }}>
              <Icon name="star" size={14} color={theme.accent} />
            </View>
          ) : null}
          <Text variant="subhead" numberOfLines={2} style={{ flex: 1, fontWeight: "500" }}>
            {item.title}
          </Text>
        </View>
        {s.tag ? <Pill label={s.tag.label} tone={TAG_TONE[s.tag.kind]} /> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {item.price ? (
            <Text variant="footnote" style={{ fontWeight: "600" }}>
              {formatPrice(item.price)}
            </Text>
          ) : null}
          <Text variant="footnote">{s.quantity}</Text>
        </View>
        {registryStore ? (
          <Text variant="footnote" tone="tertiary" numberOfLines={1}>
            Counts toward your {registryStore.name} registry
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  if (!ios) return content;

  return (
    <Link href={href} asChild>
      <Link.Trigger>{content}</Link.Trigger>
      <Link.Menu>
        <Link.MenuAction
          title={item.is_essential ? "Remove from most wanted" : "Mark most wanted"}
          icon={item.is_essential ? "star.slash" : "star"}
          onPress={() => actions.toggleMostWanted(item)}
        />
        {bought ? (
          <Link.MenuAction
            title={bought}
            icon={item.is_parent_purchased ? "arrow.uturn.backward" : "bag"}
            onPress={() => actions.toggleBought(item)}
          />
        ) : null}
        {item.external_url ? <Link.MenuAction title="Shop" icon="safari" onPress={() => openLink(item)} /> : null}
        <Link.MenuAction title="Remove item" icon="trash" destructive onPress={() => actions.remove(item)} />
      </Link.Menu>
    </Link>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
});
