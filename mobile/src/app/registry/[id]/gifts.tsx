// A list's gift activity: who reserved, gave or chipped in, newest first. The
// website's Gift Activity tab (src/app/(protected)/dashboard/registry/[registryId]/page.tsx),
// worded the same way (src/lib/gifts.ts). The list's screen opens it from its
// summary card.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, Linking, Platform, Pressable, RefreshControl, SectionList, Share, StyleSheet, View } from "react-native";

import {
  formatGiftDate,
  giftActivityFor,
  giftActivityTag,
  isOpenReservation,
  reservationsHiddenText,
} from "@shared/gifts";
import { LIST_ACCESS, listVisibility } from "@shared/list-access";

import { Icon } from "@/components/icon";
import { Button, Divider, EmptyState, ErrorState, LoadingState, Pill, Text } from "@/components/ui";
import { errorMessage, useCancelGift, useRegistry } from "@/lib/data";
import { formatPrice, initials, plural } from "@/lib/format";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { registryShareUrl } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { Gift, RegistryDetail } from "@/lib/types";

export default function GiftActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const registry = useRegistry(id);
  const pull = usePullToRefresh(registry.refetch);
  const cancelGift = useCancelGift(id);
  const data = registry.data;

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {registry.isError ? (
          <ErrorState message={errorMessage(registry.error)} onRetry={() => registry.refetch()} />
        ) : (
          <LoadingState />
        )}
      </View>
    );
  }

  const r = data.registry;
  const openSettings = () => router.push({ pathname: "/registry/[id]/settings", params: { id: r.id } });

  function shareRegistry() {
    if (listVisibility(r) === "private") {
      Alert.alert("This list is private", `${LIST_ACCESS.private.description} To share it, change who can open it in Settings.`, [
        { text: "Not now", style: "cancel" },
        { text: "Settings", onPress: openSettings },
      ]);
      return;
    }
    const url = registryShareUrl(r.slug);
    Share.share(Platform.OS === "ios" ? { url, message: r.title } : { message: `${r.title}\n${url}`, title: r.title });
  }

  return (
    <>
      <Stack.Screen options={{ title: "Gift activity" }} />
      <SectionList
        sections={data.gifts.length > 0 ? [{ title: "gifts", data: data.gifts }] : []}
        keyExtractor={(gift) => gift.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl {...pull} tintColor={theme.tint} />}
        ListHeaderComponent={data.reservationsHidden ? <HiddenNotice detail={data} onSettings={openSettings} /> : undefined}
        renderItem={({ item: gift, index, section }) => (
          <View
            style={[
              { marginHorizontal: spacing.lg, backgroundColor: theme.surface, borderColor: theme.border },
              styles.groupRow,
              index === 0 && styles.groupFirst,
              index === section.data.length - 1 && styles.groupLast,
            ]}
          >
            <GiftRow
              gift={gift}
              onPress={() =>
                giftActions(gift, (g) => cancelGift.mutate(g, { onError: (e) => Alert.alert("Couldn't cancel it", errorMessage(e)) }))
              }
            />
            {index < section.data.length - 1 ? <Divider inset={68} /> : null}
          </View>
        )}
        ListEmptyComponent={
          data.reservationsHidden ? undefined : (
            <EmptyState
              icon="gift"
              title="No gifts reserved yet"
              message="Share your registry link to get started!"
              action={
                <View style={{ width: "100%", maxWidth: 320 }}>
                  <Button title="Share your registry" icon="share" variant="secondary" onPress={shareRegistry} />
                </View>
              }
            />
          )
        }
      />
    </>
  );
}

/** The website's notice, in its words (src/lib/gifts.ts). */
function HiddenNotice({ detail, onSettings }: { detail: RegistryDetail; onSettings: () => void }) {
  const theme = useTheme();
  const text = reservationsHiddenText({
    revealedCount: detail.revealedCount,
    next: detail.nextReveal,
    turnedOnByExchange: detail.turnedOnByExchange,
  });
  return (
    <View style={[styles.hiddenNotice, { backgroundColor: theme.surfaceAlt }]}>
      <Icon name="eyeSlash" size={16} color={theme.textSecondary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="footnote" style={{ fontWeight: "600" }}>
          {text.title}
        </Text>
        {text.revealed ? (
          <Text variant="footnote" tone="secondary">
            {text.revealed}
          </Text>
        ) : null}
        {text.next ? (
          <Text variant="footnote" tone="secondary">
            {text.next}
          </Text>
        ) : null}
        <Text variant="footnote" tone="tertiary">
          {text.why}{" "}
          <Text variant="footnote" accessibilityRole="link" style={{ color: theme.tint, fontWeight: "600" }} onPress={onSettings}>
            Change this in settings
          </Text>
        </Text>
      </View>
    </View>
  );
}

/** A gift, worded as the website's Gift Activity tab words it (src/lib/gifts.ts). */
function GiftRow({ gift, onPress }: { gift: Gift; onPress: () => void }) {
  const theme = useTheme();
  const tag = giftActivityTag(gift, gift.item_bought_by_owner);
  const what = giftActivityFor(gift, gift.for_title);
  const amount = gift.kind === "fund" ? gift.amount : gift.item_price;
  const date = formatGiftDate(gift.created_at);
  const cancelled = tag.kind === "cancelled";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${gift.buyer_name}, ${tag.label}, ${what}${amount != null ? `, ${formatPrice(amount)}` : ""}, ${date}`}
      onPress={onPress}
      style={({ pressed }) => [styles.giftRow, { backgroundColor: pressed ? theme.surfaceAlt : theme.surface, opacity: cancelled ? 0.5 : 1 }]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.tintSoft }]}>
        <Text variant="subhead" style={{ color: theme.tint, fontWeight: "700" }}>
          {initials(gift.buyer_name)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text variant="subhead" style={{ fontWeight: "600" }}>
            {gift.buyer_name}
          </Text>
          <Pill label={tag.label} tone={GIFT_TAG_TONE[tag.kind]} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Text variant="footnote" tone="secondary" style={{ flexShrink: 1 }}>
            {what}
          </Text>
          {amount != null ? (
            <Text variant="footnote" style={{ fontWeight: "600" }}>
              {formatPrice(amount)}
            </Text>
          ) : null}
        </View>
        {gift.buyer_email && !gift.hide_giver ? (
          <Text variant="footnote" tone="tertiary" numberOfLines={1}>
            {gift.buyer_email}
          </Text>
        ) : null}
        {gift.message ? (
          <Text variant="footnote" tone="secondary" numberOfLines={3}>
            {gift.message}
          </Text>
        ) : null}
        <Text variant="caption" tone="tertiary">
          {date}
        </Text>
      </View>
    </Pressable>
  );
}

const GIFT_TAG_TONE = {
  gifted: "success",
  covered: "success",
  contribution: "success",
  reserved: "tint",
  cancelled: "neutral",
} as const;

function giftActions(gift: Gift, cancel: (gift: Gift) => void) {
  const buttons: Parameters<typeof Alert.alert>[2] = [];
  // No email for a Secret Santa's gift: the owners don't get to know who it is.
  if (gift.buyer_email && !gift.hide_giver) {
    buttons.push({ text: `Email ${gift.buyer_name.split(" ")[0]}`, onPress: () => Linking.openURL(`mailto:${gift.buyer_email}`) });
  }
  if (gift.kind === "item" && gift.status !== "cancelled") {
    const what = isOpenReservation(gift) ? "reservation" : "gift";
    buttons.push({
      text: `Cancel this ${what}`,
      style: "destructive",
      onPress: () =>
        Alert.alert(
          `Cancel this ${what}?`,
          `The item goes back on your registry so someone else can give it. ${gift.buyer_name} isn't told.`,
          [
            { text: "Keep it", style: "cancel" },
            { text: `Cancel ${what}`, style: "destructive", onPress: () => cancel(gift) },
          ]
        ),
    });
  }
  buttons.push({ text: "Close", style: "cancel" });
  Alert.alert(gift.buyer_name, gift.message ? `“${gift.message}”` : plural(gift.quantity, "gift"), buttons);
}

const styles = StyleSheet.create({
  hiddenNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  groupRow: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  groupFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  groupLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  giftRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: "flex-start" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
