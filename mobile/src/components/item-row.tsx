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
import { USED_CONDITIONS, type Item } from "@/lib/types";

/**
 * "Open to like-new hand-me-downs", as the website's item card tags it
 * (src/components/ui/used-condition-tag.tsx). Before a noun, "like-new" takes
 * a hyphen and "very good" doesn't.
 */
export function usedLabel(item: { minimum_condition: string | null }) {
  const condition = USED_CONDITIONS.find((c) => c.id === item.minimum_condition) ?? USED_CONDITIONS[0];
  const words = condition.id === "like-new" ? "like-new" : condition.label.toLowerCase();
  return `Open to ${words} hand-me-downs`;
}

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

/** An item on the owner's other lists only comes off this one, as on the website. */
function removeLabel(item: Item) {
  return item.otherLists && item.otherLists.length > 0 ? "Remove from list" : "Remove item";
}

/** "Also on Wishlist and Birthday", or "Also on Wishlist and 2 more lists", as the website's item card says it. */
function alsoOn(lists: string[]) {
  if (lists.length <= 2) return `Also on ${lists.join(" and ")}`;
  return `Also on ${lists[0]} and ${lists.length - 1} more lists`;
}

/** Long-press options on Android, where there's no native link menu. */
function showActions(item: Item, actions: ItemActions, selfPurchaseButton: string) {
  haptic();
  const bought = boughtAction(item, selfPurchaseButton);
  Alert.alert(item.title, undefined, [
    { text: item.is_essential ? "Remove from most wanted" : "Mark most wanted", onPress: () => actions.toggleMostWanted(item) },
    ...(bought ? [{ text: bought, onPress: () => actions.toggleBought(item) }] : []),
    ...(item.external_url ? [{ text: "Shop", onPress: () => openLink(item) }] : []),
    { text: removeLabel(item), style: "destructive" as const, onPress: () => actions.remove(item) },
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
  // The list goes with the item, so the edit form opens it as this list shows
  // it. An item on two lists has a category on each.
  const href = { pathname: "/item/[id]", params: { id: item.id, registryId: item.registry_id } } as const;

  const ios = Platform.OS === "ios";
  const content = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${s.tag ? `, ${s.tag.label}` : ""}${item.price ? `, ${formatPrice(item.price)}` : ""}, ${s.quantity}${registryStore ? `, counts toward your ${registryStore.name} registry` : ""}${item.is_essential ? ", most wanted" : ""}`}
      accessibilityHint="Opens the item to edit it"
      // On iPhone the Link below opens it and adds the long-press menu.
      onPress={ios ? undefined : () => router.push(href)}
      onLongPress={ios ? undefined : () => showActions(item, actions, selfPurchaseButton)}
      // On iPhone the Link below wraps this, and its trigger drops this
      // Pressable's style, so the row's layout is on the View inside. The
      // link shows its own highlight when pressed.
      style={({ pressed }) => ({ backgroundColor: pressed && !ios ? theme.surfaceAlt : theme.surface })}
    >
      <View style={styles.row}>
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
        {s.tag || item.is_open_to_used ? (
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {s.tag ? <Pill label={s.tag.label} tone={TAG_TONE[s.tag.kind]} /> : null}
            {item.is_open_to_used ? <Pill label={usedLabel(item)} /> : null}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {item.price ? (
            <Text variant="footnote" style={{ fontWeight: "600" }}>
              {formatPrice(item.price)}
            </Text>
          ) : null}
          <Text variant="footnote">{s.quantity}</Text>
        </View>
        {item.notes ? (
          <Text variant="footnote" tone="tertiary" numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}
        {item.otherLists && item.otherLists.length > 0 ? (
          <Text variant="footnote" tone="tertiary" numberOfLines={1}>
            {alsoOn(item.otherLists)}
          </Text>
        ) : null}
        {registryStore ? (
          <Text variant="footnote" tone="tertiary" numberOfLines={1}>
            Counts toward your {registryStore.name} registry
          </Text>
        ) : null}
      </View>
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
        <Link.MenuAction title={removeLabel(item)} icon="trash" destructive onPress={() => actions.remove(item)} />
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
