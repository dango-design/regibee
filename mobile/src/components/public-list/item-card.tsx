// One item on someone else's list, as a guest sees it: its photo, price, how
// many are still needed, its tag and its gift buttons. The website's
// PublicItemCard (src/components/public-registry-grid.tsx) shows the same,
// from the same rules (guestItemStatus in src/lib/gifts.ts).

import * as WebBrowser from "expo-web-browser";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { guestItemStatus, type GuestItemTagKind, type MyItemGift } from "@shared/gifts";
import type { PublicListItem } from "@shared/public-list-page-types";

import { Icon } from "@/components/icon";
import { ItemImage } from "@/components/item-image";
import { usedLabel } from "@/components/item-row";
import { Button, Card, Pill, Text } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { spacing, useTheme } from "@/lib/theme";

import type { GiftStep, ItemShop } from "./gift-sheet";

const TAG_TONE: Record<GuestItemTagKind, "neutral" | "tint" | "accent" | "success"> = {
  "parent-purchased": "neutral",
  reserved: "accent",
  "purchased-by-you": "success",
  gifted: "success",
  "most-wanted": "accent",
};

/** "Ann", "Ann and Bo", "Ann, Bo and Cy". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export interface GuestItemActions {
  /** Opens the gift sheet at a step. */
  openGift: (item: PublicListItem, step: GiftStep) => void;
  /** Opens the cover sheet, for an item the owners bought. */
  cover: (item: PublicListItem) => void;
  /** Opens the sheet that starts a group gift. */
  startGroupGift: (item: PublicListItem) => void;
  /** Opens one of the guest's own group gifts. */
  openGroupGift: (token: string) => void;
}

export const GuestItemCard = memo(function GuestItemCard({
  item,
  gift,
  cookieValue,
  reservedQty,
  coveredQty,
  claimedBy,
  groupGift,
  groupGiftsOn,
  selfPurchasedLabel,
  shop,
  actions,
}: {
  item: PublicListItem;
  gift?: MyItemGift;
  cookieValue?: string;
  reservedQty: number;
  coveredQty: number;
  claimedBy?: string[];
  groupGift?: { token: string; organizer: boolean };
  groupGiftsOn: boolean;
  selfPurchasedLabel: string;
  shop: ItemShop;
  actions: GuestItemActions;
}) {
  const theme = useTheme();
  const s = guestItemStatus(item, { gift, cookieValue, reservedQty, coveredQty, groupGift, groupGiftsOn, selfPurchasedLabel });

  let buttons: React.ReactNode = null;
  if (s.showsActions) {
    if (s.myGroupGift) {
      const token = s.myGroupGift.token;
      buttons = <Button title="Open group gift" icon="people" variant="secondary" size="small" onPress={() => actions.openGroupGift(token)} />;
    } else if (item.is_parent_purchased) {
      buttons = gift ? (
        <Button title="View your gift" variant="ghost" size="small" onPress={() => actions.cover(item)} />
      ) : (
        <Button title="Gift this" icon="gift" size="small" onPress={() => actions.cover(item)} />
      );
    } else if (!gift) {
      buttons = (
        <>
          {s.canStartGroupGift ? (
            <Button title="Group gift" icon="people" variant="secondary" size="small" onPress={() => actions.startGroupGift(item)} />
          ) : null}
          {s.remaining > 0 ? <Button title="Gift this" icon="gift" size="small" onPress={() => actions.openGift(item, "reserve")} /> : null}
        </>
      );
    } else if (gift.status === "reserved") {
      buttons = (
        <>
          <Button title="Release" variant="ghost" size="small" onPress={() => actions.openGift(item, "release")} />
          <Button title="Finish gift" size="small" onPress={() => actions.openGift(item, "buy")} />
        </>
      );
    } else {
      buttons = <Button title="View your gift" variant="ghost" size="small" onPress={() => actions.openGift(item, "details")} />;
    }
  }

  return (
    <Card style={{ gap: spacing.md, opacity: s.looksDone ? 0.7 : 1, padding: spacing.md }}>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Pressable
          accessibilityRole={item.external_url ? "link" : undefined}
          accessibilityLabel={item.external_url ? `See the ${item.title} at the store` : undefined}
          disabled={!item.external_url}
          onPress={() => item.external_url && WebBrowser.openBrowserAsync(item.external_url)}
        >
          <ItemImage uri={item.image_url} size={88} />
          {s.itemPurchased ? (
            <View style={{ position: "absolute", right: -4, bottom: -4, width: 26, height: 26, borderRadius: 13, backgroundColor: theme.success, alignItems: "center", justifyContent: "center" }}>
              <Icon name="heart" size={14} color={theme.onTint} />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="subhead" style={{ fontWeight: "600" }}>
            {item.title}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8 }}>
            {item.price ? (
              <Text variant="footnote" style={{ fontWeight: "600" }}>
                {formatPrice(item.price)}
              </Text>
            ) : null}
            <Text variant="footnote" tone="secondary">
              {s.quantity}
            </Text>
          </View>
          {shop.shopName && item.external_url ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="store" size={12} color={theme.textTertiary} />
              <Text variant="footnote" tone="tertiary" numberOfLines={1}>
                From {shop.shopName}
              </Text>
            </View>
          ) : null}
          {s.tag || item.is_open_to_used ? (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              {s.tag ? <Pill label={s.tag.label} tone={TAG_TONE[s.tag.kind]} icon={s.tag.kind === "most-wanted" ? "star" : undefined} /> : null}
              {item.is_open_to_used ? <Pill label={usedLabel(item)} /> : null}
            </View>
          ) : null}
        </View>
      </View>
      {item.notes ? (
        <Text variant="footnote" tone="secondary">
          {item.notes}
        </Text>
      ) : null}
      {claimedBy && claimedBy.length > 0 ? (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
          <Icon name="people" size={13} color={theme.tint} />
          <Text variant="footnote" tone="tint" style={{ flex: 1, fontWeight: "500" }}>
            {`${gift ? "Also reserved" : "Reserved"} by ${joinNames(claimedBy)}`}
          </Text>
        </View>
      ) : null}
      {buttons ? <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: spacing.sm }}>{buttons}</View> : null}
    </Card>
  );
});
