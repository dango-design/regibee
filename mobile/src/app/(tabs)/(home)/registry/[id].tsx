import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Share,
  StyleSheet,
  View,
} from "react-native";

import {
  formatGiftDate,
  giftActivityFor,
  giftActivityTag,
  isOpenReservation,
  readReservationPrivacy,
  reservationsHiddenText,
} from "@shared/gifts";
import { LIST_ACCESS, listAccess, listVisibility } from "@shared/list-access";

import { Icon } from "@/components/icon";
import { ItemRow, type ItemActions } from "@/components/item-row";
import {
  Button,
  Chip,
  Divider,
  EmptyState,
  ErrorState,
  haptic,
  IconButton,
  LoadingState,
  Pill,
  ProgressBar,
  Text,
} from "@/components/ui";
import {
  errorMessage,
  storeRegistries,
  useCancelGift,
  useDeleteItem,
  useGifts,
  useRegistry,
  useToggleItem,
} from "@/lib/data";
import { formatDollars, formatEventDate, formatPrice, initials, plural } from "@/lib/format";
import { occasionLabel } from "@/lib/occasion";
import { copyForRegistry } from "@shared/registry-copy";
import { registryShareUrl, SITE_URL } from "@/lib/supabase";
import { fonts, radius, spacing, useTheme } from "@/lib/theme";
import type { Gift, Item, RegistryDetail } from "@/lib/types";

type Tab = "items" | "gifts";

export default function RegistryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const registry = useRegistry(id);
  const gifts = useGifts(id);
  const [tab, setTab] = useState<Tab>("items");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");

  const { mutate: toggleItem } = useToggleItem();
  const { mutate: removeItem } = useDeleteItem();
  const cancelGift = useCancelGift(id);

  const actions: ItemActions = useMemo(
    () => ({
      toggleMostWanted: (item) => {
        haptic("success");
        toggleItem({ item, field: "is_essential" }, { onError: (e) => Alert.alert("Couldn't change it", errorMessage(e)) });
      },
      toggleBought: (item) => {
        haptic("success");
        toggleItem({ item, field: "is_parent_purchased" }, { onError: (e) => Alert.alert("Couldn't change it", errorMessage(e)) });
      },
      remove: (item) =>
        Alert.alert(`Delete “${item.title}”?`, "This cannot be undone.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove item",
            style: "destructive",
            onPress: () => removeItem(item, { onError: (e) => Alert.alert("Couldn't delete it", errorMessage(e)) }),
          },
        ]),
    }),
    // mutate is stable, so the rows don't all redraw while a change saves.
    [toggleItem, removeItem]
  );

  const data = registry.data;
  // Cancelled gifts stay in the list, faded, as on the website.
  const allGifts = gifts.data ?? [];

  const sections = useMemo(() => (data ? itemSections(data, categoryFilter) : []), [data, categoryFilter]);
  // One array for every row, kept while the registry row is unchanged, so
  // changing an item doesn't redraw them all.
  const registryRow = data?.registry;
  const linkedStores = useMemo(
    () => (registryRow ? (storeRegistries(registryRow)?.map((r) => r.store) ?? null) : null),
    [registryRow]
  );

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
  const shareUrl = registryShareUrl(r.slug);
  const selfPurchaseButton = copyForRegistry(r).selfPurchaseButton;

  const visibility = listVisibility(r);

  function shareRegistry() {
    if (visibility === "private") {
      Alert.alert(
        "This list is private",
        `${LIST_ACCESS.private.description} To share it, change who can open it in the list's settings on the website.`
      );
      return;
    }
    Share.share(
      Platform.OS === "ios" ? { url: shareUrl, message: r.title } : { message: `${r.title}\n${shareUrl}`, title: r.title }
    );
  }

  function moreActions() {
    const open = (path: string) => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);
    Alert.alert(r.title, undefined, [
      { text: "Preview", onPress: () => open(`/r/${r.slug}`) },
      {
        text: data!.pendingSuggestions > 0 ? `Suggestions (${data!.pendingSuggestions})` : "Suggestions",
        onPress: () => open(`/dashboard/registry/${r.id}?tab=suggestions`),
      },
      { text: "Settings", onPress: () => open(`/dashboard/registry/${r.id}/settings`) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const header = (
    <RegistryHeader
      detail={data}
      tab={tab}
      giftCount={allGifts.length}
      onTab={(next) => {
        haptic();
        setTab(next);
      }}
      categoryFilter={categoryFilter}
      onCategory={setCategoryFilter}
    />
  );

  const refresh = (
    <RefreshControl
      refreshing={registry.isRefetching || gifts.isRefetching}
      onRefresh={() => {
        registry.refetch();
        gifts.refetch();
      }}
      tintColor={theme.tint}
    />
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: r.title,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <IconButton icon="share" accessibilityLabel="Share registry link" onPress={shareRegistry} />
              <IconButton icon="more" accessibilityLabel="More" onPress={moreActions} />
              <IconButton
                icon="add"
                accessibilityLabel="Add an item"
                onPress={() => router.push({ pathname: "/add", params: { registryId: r.id } })}
              />
            </View>
          ),
        }}
      />
      {tab === "items" ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={refresh}
          ListHeaderComponent={header}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
              <Text variant="headline" style={{ fontFamily: fonts.displayMedium }}>
                {section.title}
              </Text>
              <Text variant="footnote" tone="tertiary">
                {section.data.length}
              </Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <View
              style={[
                { marginHorizontal: spacing.lg, backgroundColor: theme.surface, borderColor: theme.border },
                styles.groupRow,
                index === 0 && styles.groupFirst,
                index === section.data.length - 1 && styles.groupLast,
              ]}
            >
              <ItemRow item={item} actions={actions} linkedStores={linkedStores} selfPurchaseButton={selfPurchaseButton} />
              {index < section.data.length - 1 ? <Divider inset={92} /> : null}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="bag"
              title={data.items.length === 0 ? "No items yet" : "Nothing in this category"}
              message={data.items.length === 0 ? "Add items from any store to get started." : undefined}
              action={
                data.items.length === 0 ? (
                  <View style={{ width: "100%", maxWidth: 320 }}>
                    <Button
                      title="Add item"
                      icon="add"
                      onPress={() => router.push({ pathname: "/add", params: { registryId: r.id } })}
                    />
                  </View>
                ) : null
              }
            />
          }
        />
      ) : (
        <SectionList
          sections={allGifts.length > 0 ? [{ title: "gifts", data: allGifts }] : []}
          keyExtractor={(gift) => gift.id}
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={refresh}
          ListHeaderComponent={header}
          renderItem={({ item: gift, index, section }) => (
            <View
              style={[
                { marginHorizontal: spacing.lg, backgroundColor: theme.surface, borderColor: theme.border },
                styles.groupRow,
                index === 0 && styles.groupFirst,
                index === section.data.length - 1 && styles.groupLast,
              ]}
            >
              <GiftRow gift={gift} onPress={() => giftActions(gift, (g) => cancelGift.mutate(g, { onError: (e) => Alert.alert("Couldn't cancel it", errorMessage(e)) }))} />
              {index < section.data.length - 1 ? <Divider inset={68} /> : null}
            </View>
          )}
          ListEmptyComponent={
            gifts.isPending ? (
              <LoadingState />
            ) : gifts.isError ? (
              <ErrorState message={errorMessage(gifts.error)} onRetry={() => gifts.refetch()} />
            ) : data.reservationsHidden ? undefined : (
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
      )}
    </>
  );
}

function itemSections(detail: RegistryDetail, filter: string | "all") {
  const byCategory = new Map<string | null, Item[]>();
  for (const item of detail.items) {
    const key = detail.categories.some((c) => c.id === item.category_id) ? item.category_id : null;
    byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
  }
  const sections = detail.categories
    .filter((c) => byCategory.has(c.id))
    .map((c) => ({ key: c.id, title: c.name, data: byCategory.get(c.id)! }));
  const other = byCategory.get(null);
  if (other) sections.push({ key: "other", title: "Other", data: other });
  return filter === "all" ? sections : sections.filter((s) => s.key === filter);
}

function RegistryHeader({
  detail,
  tab,
  giftCount,
  onTab,
  categoryFilter,
  onCategory,
}: {
  detail: RegistryDetail;
  tab: Tab;
  giftCount: number;
  onTab: (tab: Tab) => void;
  categoryFilter: string;
  onCategory: (id: string) => void;
}) {
  const theme = useTheme();
  const r = detail.registry;
  // The same numbers as the website's registry page.
  const gifted = detail.items.filter((i) => i.quantity_fulfilled >= i.quantity_needed).length;
  const value = detail.items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const copy = copyForRegistry(r);
  const usedCategories = detail.categories.filter((c) => detail.items.some((i) => i.category_id === c.id));

  return (
    <View style={{ gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Text variant="display" numberOfLines={3}>
          {r.title}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Pill label={occasionLabel(r)} tone="accent" />
          {r.event_date ? <Pill label={`${copy.eventDateLabel}: ${formatEventDate(r.event_date)}`} tone="tint" icon="calendar" /> : null}
          <Pill label={listAccess(listVisibility(r)).short} icon={listVisibility(r) === "private" ? "lock" : listVisibility(r) === "public" ? "public" : "link"} />
        </View>
      </View>

      {detail.reservationsHidden ? <HiddenNotice detail={detail} /> : null}

      <View style={[styles.stats, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Stat label="Total items" value={String(detail.items.length)} />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <Stat label="Gifted" value={String(gifted)} />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <Stat label="Total value" value={formatDollars(value)} />
      </View>
      {detail.items.length > 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ProgressBar value={gifted / detail.items.length} color={theme.success} />
        </View>
      ) : null}

      {detail.funds.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {detail.funds.map((fund) => (
            <View key={fund.id} style={[styles.fund, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="fund" size={16} color={theme.success} />
                <Text variant="footnote" numberOfLines={1} style={{ fontWeight: "600", flex: 1 }}>
                  {fund.title}
                </Text>
              </View>
              {fund.description ? (
                <Text variant="caption" tone="tertiary" numberOfLines={2}>
                  {fund.description}
                </Text>
              ) : null}
              {/* The website's fund card says the same (src/components/cash-fund-card.tsx). */}
              {fund.goal_amount ? (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text variant="footnote">{formatDollars(fund.current_amount)} raised</Text>
                    <Text variant="footnote">{formatDollars(fund.goal_amount)} goal</Text>
                  </View>
                  <ProgressBar value={fund.current_amount / fund.goal_amount} color={theme.success} />
                  <Text variant="caption" tone="tertiary">
                    {formatDollars(Math.max(0, fund.goal_amount - fund.current_amount))} remaining
                  </Text>
                </>
              ) : fund.current_amount > 0 ? (
                <Text variant="footnote">{formatDollars(fund.current_amount)} raised</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.segments, { backgroundColor: theme.surfaceAlt, marginHorizontal: spacing.lg }]}>
        {(["items", "gifts"] as const).map((t) => {
          const selected = tab === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onTab(t)}
              style={[styles.segment, selected && { backgroundColor: theme.surface, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}
            >
              <Text variant="subhead" style={{ fontWeight: selected ? "600" : "500", color: selected ? theme.text : theme.textSecondary }}>
                {t === "items" ? `Items · ${detail.items.length + detail.funds.length}` : `Gifts · ${giftCount}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "items" && usedCategories.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <Chip label="All" selected={categoryFilter === "all"} onPress={() => onCategory("all")} />
          {usedCategories.map((c) => (
            <Chip key={c.id} label={c.name} selected={categoryFilter === c.id} onPress={() => onCategory(c.id)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

/**
 * The website's notice, in its words (src/lib/gifts.ts). The website also says
 * when the next event's gifts are revealed; the app doesn't load events yet.
 */
function HiddenNotice({ detail }: { detail: RegistryDetail }) {
  const theme = useTheme();
  const r = detail.registry;
  const text = reservationsHiddenText({
    revealedCount: detail.revealedCount,
    turnedOnByExchange: readReservationPrivacy(r.settings).hide_reservations_source === "exchange",
  });
  return (
    <View style={[styles.hiddenNotice, { backgroundColor: theme.surfaceAlt, marginHorizontal: spacing.lg }]}>
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
        <Text variant="footnote" tone="tertiary">
          {text.why}{" "}
          <Text
            variant="footnote"
            accessibilityRole="link"
            style={{ color: theme.tint, fontWeight: "600" }}
            onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/dashboard/registry/${r.id}/settings`)}
          >
            Change this in settings
          </Text>
        </Text>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text variant="title" style={{ fontSize: 20 }}>
        {value}
      </Text>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
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
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg + 4,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  groupRow: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  groupFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  groupLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  fund: {
    width: 200,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  segments: { flexDirection: "row", borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, height: 36, borderRadius: radius.sm + 1, alignItems: "center", justifyContent: "center" },
  giftRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: "flex-start" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
