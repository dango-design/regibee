// A list's screen: the website's list page (src/app/(protected)/dashboard/registry/[registryId]/page.tsx),
// from the same loader (src/lib/list-page.ts on the website).

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

import { formatShortEventDate, eventTypeLabel } from "@shared/events";
import {
  formatGiftDate,
  giftActivityFor,
  giftActivityTag,
  isOpenReservation,
  reservationsHiddenText,
} from "@shared/gifts";
import { LIST_ACCESS, listAccess, listVisibility } from "@shared/list-access";
import { copyForRegistry } from "@shared/registry-copy";
import { getStore } from "@shared/retailers";

import { Icon, type IconName } from "@/components/icon";
import { ItemRow, type ItemActions } from "@/components/item-row";
import { DetailReview, MissingDetailsNotice } from "@/components/list-details";
import { NavRow } from "@/components/nav-row";
import { Notice } from "@/components/notice";
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
  Section,
  Text,
} from "@/components/ui";
import {
  errorMessage,
  removeItemWording,
  useCancelGift,
  useDeleteItem,
  useDismissEventPrompt,
  useHidePlainLinks,
  useRegistry,
  useToggleItem,
  useUnlinkEvent,
} from "@/lib/data";
import { formatDollars, formatEventDate, formatPrice, initials, plural } from "@/lib/format";
import { occasionLabel } from "@/lib/occasion";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { registryShareUrl } from "@/lib/supabase";
import { fonts, radius, spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";
import { ChoiceSheet } from "@/components/choice-sheet";
import type { CashFund, Gift, Item, RegistryDetail } from "@/lib/types";

type Tab = "items" | "gifts";

export default function RegistryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const registry = useRegistry(id);
  const pull = usePullToRefresh(registry.refetch);
  const [tab, setTab] = useState<Tab>("items");
  const [moreOpen, setMoreOpen] = useState(false);
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
      remove: (item) => {
        // The website's edit dialog asks the same (src/components/edit-item-dialog.tsx).
        const wording = removeItemWording(item);
        Alert.alert(wording.title, wording.message, [
          { text: "Cancel", style: "cancel" },
          {
            text: wording.button,
            style: "destructive",
            onPress: () => removeItem(item, { onError: (e) => Alert.alert("Couldn't remove it", errorMessage(e)) }),
          },
        ]);
      },
    }),
    // mutate is stable, so the rows don't all redraw while a change saves.
    [toggleItem, removeItem]
  );

  const data = registry.data;
  const sections = useMemo(() => (data ? itemSections(data, categoryFilter) : []), [data, categoryFilter]);
  // One array for every row, kept while the list is unchanged, so changing
  // an item doesn't redraw them all.
  const linkedRegistries = data?.linkedRegistries;
  const linkedStores = useMemo(() => linkedRegistries?.map((r) => r.store) ?? null, [linkedRegistries]);

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
  const addItem = () => router.push({ pathname: "/add", params: { registryId: r.id } });
  const addFund = () => router.push({ pathname: "/fund", params: { registryId: r.id } });
  const openSettings = () => router.push({ pathname: "/registry/[id]/settings", params: { id: r.id } });

  function shareRegistry() {
    if (visibility === "private") {
      Alert.alert("This list is private", `${LIST_ACCESS.private.description} To share it, change who can open it in Settings.`, [
        { text: "Not now", style: "cancel" },
        { text: "Settings", onPress: openSettings },
      ]);
      return;
    }
    Share.share(
      Platform.OS === "ios" ? { url: shareUrl, message: r.title } : { message: `${r.title}\n${shareUrl}`, title: r.title }
    );
  }

  // A sheet, since Android's alert shows at most three buttons.
  const moreChoices = [
    { label: "Preview", onPress: () => openSite(`/r/${r.slug}`) },
    { label: "Add a gift fund", onPress: addFund },
    ...(data!.showPlanEventButton
      ? [{ label: "Plan an event", onPress: () => router.push({ pathname: "/event-form", params: { registryId: r.id } }) }]
      : []),
    { label: "Settings", onPress: openSettings },
  ];

  const header = (
    <RegistryHeader
      detail={data}
      tab={tab}
      onTab={(next) => {
        haptic();
        setTab(next);
      }}
      categoryFilter={categoryFilter}
      onCategory={setCategoryFilter}
      onAddFund={addFund}
      onSettings={openSettings}
    />
  );

  const refresh = (
    <RefreshControl
      {...pull}
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
              <IconButton icon="more" accessibilityLabel="More" onPress={() => setMoreOpen(true)} />
              <IconButton icon="add" accessibilityLabel="Add an item" onPress={addItem} />
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
            data.items.length === 0 && data.funds.length === 0 ? (
              <EmptyState
                icon="bag"
                title="No items yet"
                message={
                  data.showChecklist
                    ? "Add items manually or browse the checklist."
                    : "Add items from any store to get started."
                }
                action={
                  <View style={{ width: "100%", maxWidth: 320, gap: spacing.sm }}>
                    <Button title="Add item" icon="add" onPress={addItem} />
                    {data.showChecklist ? (
                      <Button
                        title="Browse checklist"
                        icon="checklist"
                        variant="secondary"
                        onPress={() => router.push({ pathname: "/registry/[id]/checklist", params: { id: r.id } })}
                      />
                    ) : null}
                  </View>
                }
              />
            ) : data.items.length === 0 ? undefined : (
              <EmptyState icon="bag" title="Nothing in this category" />
            )
          }
        />
      ) : (
        <SectionList
          sections={data.gifts.length > 0 ? [{ title: "gifts", data: data.gifts }] : []}
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
              <GiftRow
                gift={gift}
                onPress={() =>
                  giftActions(gift, (g) =>
                    cancelGift.mutate(g, { onError: (e) => Alert.alert("Couldn't cancel it", errorMessage(e)) })
                  )
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
      )}
      <ChoiceSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title={r.title} choices={moreChoices} />
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
  onTab,
  categoryFilter,
  onCategory,
  onAddFund,
  onSettings,
}: {
  detail: RegistryDetail;
  tab: Tab;
  onTab: (tab: Tab) => void;
  categoryFilter: string;
  onCategory: (id: string) => void;
  onAddFund: () => void;
  onSettings: () => void;
}) {
  const theme = useTheme();
  const r = detail.registry;
  // The same numbers as the website's registry page.
  const gifted = detail.items.filter((i) => i.quantity_fulfilled >= i.quantity_needed).length;
  const completion = detail.items.length > 0 ? gifted / detail.items.length : 0;
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
          <Pill
            label={listAccess(listVisibility(r)).short}
            icon={listVisibility(r) === "private" ? "lock" : listVisibility(r) === "public" ? "public" : "link"}
          />
          {detail.role === "manager" ? <Pill label="Manager" icon="people" /> : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        {detail.reservationsHidden ? <HiddenNotice detail={detail} onSettings={onSettings} /> : null}
        <EventsBanner detail={detail} />
        {/* Above the items, in the website's order: the review, what's missing, then plain links. */}
        {tab === "items" ? <DetailReview registryId={r.id} reviews={detail.detailReview} /> : null}
        {tab === "items" ? <MissingDetailsNotice registryId={r.id} items={detail.missingDetails} /> : null}
        {tab === "items" ? <PlainLinksNotices detail={detail} /> : null}
      </View>

      <View style={[styles.stats, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Stat label="Total items" value={String(detail.items.length)} />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <Stat label="Gifted" value={String(gifted)} />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <Stat label="Completion" value={`${Math.round(completion * 100)}%`} />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <Stat label="Total value" value={formatDollars(value)} />
      </View>
      {detail.items.length > 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ProgressBar value={completion} color={theme.success} />
        </View>
      ) : null}

      <ListTools detail={detail} />

      <View style={{ gap: spacing.sm }}>
        <View style={styles.fundsHeader}>
          <Text variant="headline" style={{ fontFamily: fonts.displayMedium }}>
            Gift Funds
          </Text>
          <Button title="Add Fund" icon="add" size="small" variant="ghost" onPress={onAddFund} />
        </View>
        {detail.funds.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {detail.funds.map((fund) => (
              <FundCard key={fund.id} fund={fund} gifts={detail.gifts.filter((g) => g.cash_fund_id === fund.id)} />
            ))}
          </ScrollView>
        ) : (
          <Text variant="footnote" tone="tertiary" style={{ paddingHorizontal: spacing.lg }}>
            Let guests give money toward something bigger, like a stroller or a honeymoon.
          </Text>
        )}
      </View>

      <View style={[styles.segments, { backgroundColor: theme.surfaceAlt, marginHorizontal: spacing.lg }]}>
        {(["items", "gifts"] as const).map((t) => {
          const selected = tab === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onTab(t)}
              style={[
                styles.segment,
                selected && {
                  backgroundColor: theme.surface,
                  shadowColor: "#000",
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                },
              ]}
            >
              <Text variant="subhead" style={{ fontWeight: selected ? "600" : "500", color: selected ? theme.text : theme.textSecondary }}>
                {t === "items" ? `Items · ${detail.items.length + detail.funds.length}` : `Gift Activity · ${detail.gifts.length}`}
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

/** The checklist, the Suggestions Inbox and Store perks: the website's tabs and buttons beside the items. */
function ListTools({ detail }: { detail: RegistryDetail }) {
  const id = detail.registry.id;
  const rows: { icon: IconName; label: string; detail?: string; badge?: number; onPress: () => void }[] = [];
  if (detail.showChecklist) {
    rows.push({
      icon: "checklist",
      label: "Checklist",
      detail: `${detail.checklistProgress.matched} of ${detail.checklistProgress.total} added`,
      onPress: () => router.push({ pathname: "/registry/[id]/checklist", params: { id } }),
    });
  }
  rows.push({
    icon: "inbox",
    label: "Suggestions Inbox",
    detail: detail.suggestions.length === 0 ? "Ideas guests send you" : undefined,
    badge: detail.pendingSuggestions,
    onPress: () => router.push({ pathname: "/registry/[id]/suggestions", params: { id } }),
  });
  if (detail.perkRows.length > 0) {
    rows.push({
      icon: "tag",
      label: "Store perks",
      badge: detail.readyPerkCount,
      onPress: () => router.push({ pathname: "/registry/[id]/perks", params: { id } }),
    });
  }
  rows.push({
    icon: "settings",
    label: "Settings",
    onPress: () => router.push({ pathname: "/registry/[id]/settings", params: { id } }),
  });

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <Section>
        {rows.map((row, index) => (
          <View key={row.label}>
            {index > 0 ? <Divider inset={52} /> : null}
            <NavRow {...row} />
          </View>
        ))}
      </Section>
    </View>
  );
}

/** The website's events banner on a list's page (src/components/registry-events-banner.tsx). */
function EventsBanner({ detail }: { detail: RegistryDetail }) {
  const theme = useTheme();
  const id = detail.registry.id;
  const dismiss = useDismissEventPrompt(id);
  const unlink = useUnlinkEvent(id);
  const plan = () => router.push({ pathname: "/event-form", params: { registryId: id } });

  if (detail.linkedEvents.length === 0) {
    if (!detail.canPlanEvents || detail.eventPromptDismissed) return null;
    return (
      <Notice
        icon="party"
        title="Planning a party?"
        message="Send invitations and track RSVPs, with guests linked to this registry."
        action={{ title: "Plan an event", onPress: plan }}
        secondary={{
          title: "Dismiss",
          onPress: () => dismiss.mutate(undefined, { onError: (e) => Alert.alert("Couldn't dismiss it", errorMessage(e)) }),
        }}
      />
    );
  }

  return (
    <Notice
      icon="party"
      tone="accent"
      title={detail.linkedEvents.length === 1 ? "Linked event" : "Linked events"}
      action={detail.canPlanEvents ? { title: "Plan another event", icon: "add", onPress: plan } : undefined}
    >
      <View style={{ gap: spacing.sm, paddingLeft: 46 }}>
        {detail.linkedEvents.map((event) => {
          const hosted = event.canManage;
          const when = event.event_date ? formatShortEventDate(event.event_date) : eventTypeLabel(event.event_type);
          return (
            <View key={event.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Pressable
                accessibilityRole="link"
                style={{ flex: 1 }}
                onPress={() =>
                  hosted
                    ? router.push({ pathname: "/events/[eventId]", params: { eventId: event.id } })
                    : openSite(`/e/${event.slug}`)
                }
              >
                <Text variant="footnote" tone="secondary">
                  <Text variant="footnote" style={{ color: theme.tint, fontWeight: "600" }}>
                    {event.title}
                  </Text>
                  {` · ${when}`}
                  {hosted ? "" : " · hosted by someone else"}
                </Text>
              </Pressable>
              {!hosted ? (
                <Button
                  title="Unlink"
                  size="small"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert(`Unlink “${event.title}”?`, "This list won't show on the event's invitation anymore.", [
                      { text: "Keep it", style: "cancel" },
                      {
                        text: "Unlink",
                        style: "destructive",
                        onPress: () => unlink.mutate(event.id, { onError: (e) => Alert.alert("Couldn't unlink it", errorMessage(e)) }),
                      },
                    ])
                  }
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </Notice>
  );
}

/** The website's plain store links notice (src/components/plain-links-notice.tsx). */
function PlainLinksNotices({ detail }: { detail: RegistryDetail }) {
  const hide = useHidePlainLinks(detail.registry.id);
  return (
    <>
      {detail.plainLinkGroups.map((group) => {
        const store = getStore(group.storeId);
        const count = group.items.length;
        const one = count === 1;
        const linked = detail.linkedRegistries?.find((l) => l.store === group.storeId);
        const openUrl = linked?.url ?? store.registryPage?.openUrl ?? `https://www.${store.domain}`;
        return (
          <Notice
            key={group.storeId}
            icon="error"
            tone="accent"
            title={one ? `1 item has a plain ${store.name} link` : `${count} items have plain ${store.name} links`}
            message={
              one
                ? `Gifts bought through it won't count toward your ${store.name} registry. Add it to your ${store.name} registry, then edit the item and paste its registry link.`
                : `Gifts bought through them won't count toward your ${store.name} registry. Add them to your ${store.name} registry, then edit each item and paste its registry link.`
            }
            action={{ title: `Open my ${store.name} registry`, icon: "external", onPress: () => WebBrowser.openBrowserAsync(openUrl) }}
            secondary={{
              title: "Don't remind me",
              onPress: () =>
                hide.mutate(
                  group.items.map((i) => i.id),
                  { onError: (e) => Alert.alert("Couldn't save that", errorMessage(e)) }
                ),
            }}
          >
            <Text variant="footnote" tone="secondary" style={{ paddingLeft: 46 }}>
              {group.items.map((i) => `• ${i.title}`).join("\n")}
            </Text>
          </Notice>
        );
      })}
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

/** A gift fund, as the website's fund card shows it (src/components/cash-fund-card.tsx). Tap to edit. */
function FundCard({ fund, gifts }: { fund: CashFund; gifts: Gift[] }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the fund to edit it"
      onPress={() => router.push({ pathname: "/fund", params: { registryId: fund.registry_id, fundId: fund.id } })}
      style={({ pressed }) => [styles.fund, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}
    >
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
      {/* Counted as the website's fund card counts them. */}
      {gifts.length > 0 ? (
        <Pill
          tone="success"
          label={`${gifts[0].buyer_name}${gifts.length > 1 ? ` + ${gifts.length - 1} other${gifts.length > 2 ? "s" : ""}` : ""} contributed`}
        />
      ) : null}
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text variant="title" style={{ fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" tone="tertiary" numberOfLines={1}>
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
  fundsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: spacing.lg + 4,
    paddingRight: spacing.sm,
  },
  fund: {
    width: 220,
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
