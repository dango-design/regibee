// A list's screen: the website's list page (src/app/(protected)/dashboard/registry/[registryId]/page.tsx),
// from the same loader (src/lib/list-page.ts on the website).
//
// The top looks like the page guests see (src/components/wish-list-hero.tsx):
// a tinted, dotted band with the title, and a card hanging off its edge. The
// card holds how much has been gifted and one short row for each thing that
// needs the owner, such as a linked event or suggestions. Each row opens its
// own screen, so the items start within the first screen. Hidden gifts are a
// setting people rarely change, so they get a small icon next to the access
// pill instead of a row.

import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Share,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatShortEventDate, eventTypeLabel } from "@shared/events";
import { LIST_ACCESS, PROFILE_AUDIENCE, listAccess, listVisibility, profileAudience } from "@shared/list-access";
import { headerChoice, listHeader, type ListHeader as BandHeader } from "@shared/list-headers";
import { copyForRegistry } from "@shared/registry-copy";
import { getStore } from "@shared/retailers";
import { reservationsHiddenText } from "@shared/gifts";

import { Icon, type IconName } from "@/components/icon";
import { ItemRow, type ItemActions } from "@/components/item-row";
import { HeaderMenu, type HeaderMenuChoice } from "@/components/header-menu";
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
  removeItemWording,
  useDeleteItem,
  useDismissEventPrompt,
  useRegistry,
  useSortIntoCategories,
  useToggleItem,
  useUndoCategorySort,
  useUnlinkEvent,
} from "@/lib/data";
import { formatDollars, formatEventDate, plural } from "@/lib/format";
import { occasionLabel } from "@/lib/occasion";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { registryShareUrl } from "@/lib/supabase";
import { fonts, radius, spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";
import type { CashFund, Gift, Item, RegistryDetail } from "@/lib/types";

/** The gap between the band's dots, as on the website. */
const DOT_GAP = 20;
/** How far the card overlaps the band's bottom edge. */
const CARD_OVERLAP = 40;

export default function RegistryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const registry = useRegistry(id);
  const pull = usePullToRefresh(registry.refetch);
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  // The header shows the list's name once the band's title has scrolled away.
  const [scrolled, setScrolled] = useState(false);
  const sortItems = useSortIntoCategories(id);
  const undoSort = useUndoCategorySort(id);

  const { mutate: toggleItem } = useToggleItem();
  const { mutate: removeItem } = useDeleteItem();

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
  const checks = useMemo(() => (data ? itemChecks(data) : new Map<string, string>()), [data]);

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

  /** Puts the items with no category into the ones that fit, as the website's button does. */
  function sortIntoCategories() {
    const count = itemSections(data!, "all").find((s) => s.key === "other")?.data.length ?? 0;
    sortItems.mutate(undefined, {
      onError: (e) => Alert.alert("Couldn't sort the items", errorMessage(e)),
      onSuccess: ({ sorted, added, undo }) => {
        if (sorted === 0) {
          Alert.alert(
            count === 1 ? "We couldn't tell which category this item fits." : "We couldn't tell which categories these items fit."
          );
          return;
        }
        haptic("success");
        const left = count - sorted;
        const message = [
          added === 0 ? null : added === 1 ? "Added 1 new category." : `Added ${added} new categories.`,
          left <= 0 ? null : left === 1 ? "1 item didn't fit one." : `${left} items didn't fit one.`,
        ]
          .filter(Boolean)
          .join(" ");
        Alert.alert(sorted === 1 ? "Sorted 1 item into a category" : `Sorted ${sorted} items into categories`, message || undefined, [
          {
            text: "Undo",
            style: "destructive",
            onPress: () => undoSort.mutate(undo, { onError: (e) => Alert.alert("Couldn't undo the sort", errorMessage(e)) }),
          },
          { text: "OK", style: "cancel" },
        ]);
      },
    });
  }

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

  // The tools that don't need a row on the card live here.
  const moreChoices: HeaderMenuChoice[] = [
    { label: "Preview", icon: "eye", onPress: () => openSite(`/r/${r.slug}`) },
    { label: "Add a gift fund", icon: "fund", onPress: addFund },
    // Once the card's "Planning a party?" is dismissed, or the list has an
    // event, planning one is here.
    ...(data.canPlanEvents && (data.eventPromptDismissed || data.linkedEvents.length > 0)
      ? [
          {
            label: "Plan an event",
            icon: "calendar" as const,
            onPress: () => router.push({ pathname: "/event-form", params: { registryId: r.id } }),
          },
        ]
      : []),
    { label: "Gift activity", icon: "gift", onPress: () => router.push({ pathname: "/registry/[id]/gifts", params: { id: r.id } }) },
    {
      label: "Suggestions Inbox",
      icon: "inbox",
      onPress: () => router.push({ pathname: "/registry/[id]/suggestions", params: { id: r.id } }),
    },
    ...(data.perkRows.length > 0
      ? [
          {
            label: "Store perks",
            icon: "tag" as const,
            onPress: () => router.push({ pathname: "/registry/[id]/perks", params: { id: r.id } }),
          },
        ]
      : []),
    { label: "Settings", icon: "settings", onPress: openSettings },
  ];

  const header = (
    <ListHeader
      detail={data}
      categoryFilter={categoryFilter}
      onCategory={setCategoryFilter}
      onSettings={openSettings}
      bandTop={insets.top}
    />
  );

  // On iPhone the list starts under the header, so at rest it's scrolled to
  // about minus the header's height. Android's starts at 0. The title has
  // gone by about 120 points down the band.
  const band = listHeader(headerChoice(r.settings));
  const bandColor = theme.dark ? band.color.dark.bg : band.color.light.bg;
  const restOffset = Platform.OS === "ios" ? -(insets.top + 44) : 0;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y - restOffset > 120;
    if (next !== scrolled) setScrolled(next);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: scrolled ? r.title : "",
          // At the top, the header takes the band's colour, so the band
          // starts at the top of the screen.
          headerStyle: { backgroundColor: scrolled ? theme.background : bandColor },
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <IconButton icon="share" accessibilityLabel="Share registry link" onPress={shareRegistry} />
              <HeaderMenu accessibilityLabel="More" title={r.title} choices={moreChoices} />
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          refreshControl={<RefreshControl {...pull} tintColor={theme.tint} />}
          onScroll={onScroll}
          scrollEventThrottle={32}
          ListHeaderComponent={header}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: theme.background },
                section.key === "other" && { alignItems: "center" },
              ]}
            >
              <Text variant="headline" style={{ fontFamily: fonts.displayMedium }}>
                {section.title}
              </Text>
              {section.key === "other" ? (
                <Button
                  title="Sort into categories"
                  size="small"
                  variant="secondary"
                  loading={sortItems.isPending}
                  onPress={sortIntoCategories}
                />
              ) : (
                <Text variant="footnote" tone="tertiary">
                  {section.data.length}
                </Text>
              )}
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <GroupRow first={index === 0} last={index === section.data.length - 1}>
              <ItemRow
                item={item}
                actions={actions}
                linkedStores={linkedStores}
                selfPurchaseButton={selfPurchaseButton}
                check={checks.get(item.id)}
              />
            </GroupRow>
          )}
          ListFooterComponent={
            categoryFilter === "all" && data.funds.length > 0 ? <FundsSection detail={data} onAdd={addFund} /> : undefined
          }
          ListEmptyComponent={
            data.items.length === 0 && data.funds.length === 0 ? (
              <EmptyState
                icon="bag"
                title="No items yet"
                action={
                  data.showChecklist ? (
                    <View style={{ width: "100%", maxWidth: 320 }}>
                      <Button
                        title="Browse checklist"
                        icon="checklist"
                        variant="secondary"
                        onPress={() => router.push({ pathname: "/registry/[id]/checklist", params: { id: r.id } })}
                      />
                    </View>
                  ) : undefined
                }
              />
            ) : data.items.length === 0 ? undefined : (
              <EmptyState icon="bag" title="Nothing in this category" />
            )
          }
        />
        {/* Always in reach of the thumb, as on the guest page's mock-up. */}
        <View pointerEvents="box-none" style={[styles.fabWrap, { bottom: Math.max(insets.bottom, spacing.lg) + spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add an item"
            onPress={() => {
              haptic();
              addItem();
            }}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: theme.tint, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <Icon name="add" size={18} color={theme.onTint} weight="bold" />
            <Text variant="callout" style={{ color: theme.onTint, fontWeight: "600" }}>
              Add item
            </Text>
          </Pressable>
        </View>
      </View>
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

/**
 * The tag each item gets when the "Items to check" screen has something to
 * say about it. Plain links matter most, since gifts bought through them
 * don't count toward the store registry.
 */
function itemChecks(detail: RegistryDetail) {
  const checks = new Map<string, string>();
  for (const review of detail.detailReview) checks.set(review.itemId, "New details to check");
  for (const item of detail.missingDetails) checks.set(item.id, "No photo or price");
  for (const group of detail.plainLinkGroups) {
    const store = getStore(group.storeId);
    for (const item of group.items) checks.set(item.id, `Plain ${store.name} link`);
  }
  return checks;
}

/** One row of a rounded group, with a hairline between rows. */
function GroupRow({ first, last, children }: { first: boolean; last: boolean; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        { marginHorizontal: spacing.lg, backgroundColor: theme.surface, borderColor: theme.border },
        styles.groupRow,
        first && styles.groupFirst,
        last && styles.groupLast,
      ]}
    >
      {children}
      {last ? null : <Divider inset={92} />}
    </View>
  );
}

function ListHeader({
  detail,
  categoryFilter,
  onCategory,
  onSettings,
  bandTop,
}: {
  detail: RegistryDetail;
  categoryFilter: string;
  onCategory: (id: string) => void;
  onSettings: () => void;
  /** How far the band reaches up behind the header and status bar. */
  bandTop: number;
}) {
  const theme = useTheme();
  const r = detail.registry;
  const copy = copyForRegistry(r);
  const usedCategories = detail.categories.filter((c) => detail.items.some((i) => i.category_id === c.id));
  const visibility = listVisibility(r);
  const audience = profileAudience(r);
  const access =
    visibility === "private" ? listAccess(visibility).label : `${listAccess(visibility).short} · ${PROFILE_AUDIENCE[audience].short}`;
  const itemCount = detail.items.length;
  // The color and pattern the owner chose on the website (@shared/list-headers).
  const header = listHeader(headerChoice(r.settings));
  const tones = theme.dark ? header.color.dark : header.color.light;

  return (
    <View style={{ paddingBottom: spacing.sm }}>
      <DottedBand bleed={bandTop + 200} header={header}>
        <View style={styles.bandInner}>
          {r.photo_url ? (
            <Image
              source={{ uri: r.photo_url }}
              style={[styles.photo, { borderColor: theme.surface }]}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <Text variant="caption" style={[styles.eyebrow, { color: tones.ink }]}>
            {`${occasionLabel(r)} · ${plural(itemCount, "item")}`.toUpperCase()}
          </Text>
          <Text variant="display" numberOfLines={3} style={{ textAlign: "center" }}>
            {r.title}
          </Text>
          <View style={styles.pills}>
            {r.event_date ? (
              <Pill label={`${copy.eventDateLabel}: ${formatEventDate(r.event_date)}`} tone="tint" icon="calendar" />
            ) : null}
            {detail.role === "manager" ? <Pill label="Manager" icon="people" /> : null}
          </View>
          <View style={styles.accessRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${access}. Opens Settings`}
              onPress={onSettings}
              style={({ pressed }) => [
                styles.access,
                { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Icon
                name={visibility === "private" ? "lock" : visibility === "public" ? "public" : "link"}
                size={12}
                color={theme.textSecondary}
              />
              <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1, fontWeight: "500" }}>
                {access}
              </Text>
            </Pressable>
            {detail.reservationsHidden ? <HiddenGiftsButton detail={detail} onSettings={onSettings} /> : null}
          </View>
        </View>
      </DottedBand>

      <SummaryCard detail={detail} />

      {usedCategories.length > 1 ? (
        <View style={{ paddingTop: spacing.lg }}>
          <CategoryChips categories={usedCategories} selected={categoryFilter} onSelect={onCategory} />
        </View>
      ) : null}
    </View>
  );
}

/** The categories that have items, in a row that scrolls sideways. */
function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: { id: string; name: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
    >
      <Chip label="All" selected={selected === "all"} onPress={() => onSelect("all")} />
      {categories.map((c) => (
        <Chip key={c.id} label={c.name} selected={selected === c.id} onPress={() => onSelect(c.id)} />
      ))}
    </ScrollView>
  );
}

/**
 * The guest page's band, in the color the owner chose. It reaches up by
 * `bleed` behind the header and past the top when pulled down, so no strip
 * of another colour shows above it.
 *
 * Only the Dots pattern is drawn here so far. The website's other patterns
 * are SVG tiles, and the app draws those bands plain until it can show them.
 */
function DottedBand({ bleed, header, children }: { bleed: number; header: BandHeader; children: React.ReactNode }) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const tones = theme.dark ? header.color.dark : header.color.light;
  const color = tones.pattern;
  const dots = header.pattern.id === "dots";
  const cols = dots ? Math.ceil(size.width / DOT_GAP) : 0;
  const rows = dots ? Math.ceil(size.height / DOT_GAP) : 0;
  return (
    <View
      style={{ backgroundColor: tones.bg, paddingBottom: CARD_OVERLAP + spacing.lg }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== size.width || height !== size.height) setSize({ width, height });
      }}
    >
      <View style={{ position: "absolute", left: 0, right: 0, top: -bleed, height: bleed, backgroundColor: tones.bg }} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: rows }, (_, row) => (
          <View key={row} style={{ flexDirection: "row", height: DOT_GAP }}>
            {Array.from({ length: cols }, (_, col) => (
              <View key={col} style={{ width: DOT_GAP, height: DOT_GAP, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 2.8, height: 2.8, borderRadius: 1.4, backgroundColor: color }} />
              </View>
            ))}
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}

/**
 * A small eye icon beside the access pill, shown when the owner hides what's
 * been reserved from themselves. A tap explains it in the gifts screen's
 * words and offers Gift activity and Settings.
 */
function HiddenGiftsButton({ detail, onSettings }: { detail: RegistryDetail; onSettings: () => void }) {
  const theme = useTheme();
  const text = reservationsHiddenText({
    revealedCount: detail.revealedCount,
    next: detail.nextReveal,
    turnedOnByExchange: detail.turnedOnByExchange,
  });
  const explain = () =>
    Alert.alert(text.title, [text.revealed, text.next, text.why].filter(Boolean).join("\n\n"), [
      {
        text: "Gift activity",
        onPress: () => router.push({ pathname: "/registry/[id]/gifts", params: { id: detail.registry.id } }),
      },
      { text: "Settings", onPress: onSettings },
      { text: "OK", style: "cancel" },
    ]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Gifts hidden from you"
      accessibilityHint="Explains what's hidden"
      hitSlop={8}
      onPress={() => {
        haptic();
        explain();
      }}
      style={({ pressed }) => [
        styles.hiddenButton,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name="eyeSlash" size={13} color={theme.textSecondary} />
    </Pressable>
  );
}

/**
 * The card under the band: how much has been gifted, then one row for each
 * thing that needs the owner. A row shows only when it has something to say.
 */
function SummaryCard({ detail }: { detail: RegistryDetail }) {
  const theme = useTheme();
  const r = detail.registry;
  const id = r.id;
  const dismiss = useDismissEventPrompt(id);
  const unlink = useUnlinkEvent(id);
  // The same numbers as the guest page.
  const gifted = detail.items.filter((i) => i.quantity_fulfilled >= i.quantity_needed).length;
  const total = detail.items.length;
  const completion = total > 0 ? gifted / total : 0;
  const reviewCount = detail.detailReview.length;
  const missingCount = detail.missingDetails.length;
  const plainCount = detail.plainLinkGroups.reduce((sum, g) => sum + g.items.length, 0);
  const checkCount = reviewCount + missingCount + plainCount;

  const rows: RowProps[] = [];
  const openGifts = () => router.push({ pathname: "/registry/[id]/gifts", params: { id } });

  if (detail.reservationsHidden) {
    // The band's eye icon says gifts are hidden. A row only shows when an
    // event has passed and its gifts are shown, for thank-you notes.
    if (detail.revealedCount) {
      rows.push({ key: "gifts", icon: "gift", label: "Gift activity", detail: `${detail.revealedCount} revealed`, onPress: openGifts });
    }
  } else if (detail.gifts.length > 0) {
    rows.push({ key: "gifts", icon: "gift", label: "Gift activity", detail: plural(detail.gifts.length, "gift"), onPress: openGifts });
  }

  for (const event of detail.linkedEvents) {
    const hosted = event.canManage;
    const when = event.event_date ? formatShortEventDate(event.event_date) : eventTypeLabel(event.event_type);
    const open = () =>
      hosted ? router.push({ pathname: "/events/[eventId]", params: { eventId: event.id } }) : openSite(`/e/${event.slug}`);
    rows.push({
      key: `event-${event.id}`,
      icon: "party",
      label: event.title,
      detail: when ?? undefined,
      onPress:
        hosted || event.guestList
          ? open
          : // Someone else's event: the old banner's Unlink button lives here now.
            () =>
              Alert.alert(event.title, `${when ?? ""}${when ? " · " : ""}Hosted by someone else`, [
                { text: "Open invitation", onPress: open },
                {
                  text: "Unlink from this list",
                  style: "destructive",
                  onPress: () =>
                    Alert.alert(`Unlink “${event.title}”?`, "This list won't show on the event's invitation anymore.", [
                      { text: "Keep it", style: "cancel" },
                      {
                        text: "Unlink",
                        style: "destructive",
                        onPress: () => unlink.mutate(event.id, { onError: (e) => Alert.alert("Couldn't unlink it", errorMessage(e)) }),
                      },
                    ]),
                },
                { text: "Close", style: "cancel" },
              ]),
    });
  }
  if (detail.linkedEvents.length === 0 && detail.canPlanEvents && !detail.eventPromptDismissed) {
    rows.push({
      key: "plan",
      icon: "party",
      label: "Planning a party?",
      detail: "Plan an event",
      onPress: () => router.push({ pathname: "/event-form", params: { registryId: id } }),
      onDismiss: () => dismiss.mutate(undefined, { onError: (e) => Alert.alert("Couldn't dismiss it", errorMessage(e)) }),
    });
  }

  if (detail.showChecklist) {
    rows.push({
      key: "checklist",
      icon: "checklist",
      label: "Checklist",
      detail: `${detail.checklistProgress.matched} of ${detail.checklistProgress.total} added`,
      onPress: () => router.push({ pathname: "/registry/[id]/checklist", params: { id } }),
    });
  }
  if (detail.pendingSuggestions > 0) {
    rows.push({
      key: "suggestions",
      icon: "inbox",
      label: detail.pendingSuggestions === 1 ? "1 suggestion from a guest" : `${detail.pendingSuggestions} suggestions from guests`,
      badge: detail.pendingSuggestions,
      onPress: () => router.push({ pathname: "/registry/[id]/suggestions", params: { id } }),
    });
  }
  if (detail.readyPerkCount > 0) {
    rows.push({
      key: "perks",
      icon: "tag",
      label: "Store perks ready",
      badge: detail.readyPerkCount,
      onPress: () => router.push({ pathname: "/registry/[id]/perks", params: { id } }),
    });
  }
  if (checkCount > 0) {
    rows.push({
      key: "check",
      icon: "sparkles",
      label: checkLabel(reviewCount, missingCount, plainCount),
      onPress: () => router.push({ pathname: "/registry/[id]/check", params: { id } }),
    });
  }

  // Hidden gifts make the count wrong, so the guest page's progress line
  // only shows when the owner can see what's been gifted.
  const showProgress = total > 0 && !detail.reservationsHidden;
  if (!showProgress && rows.length === 0) return <View style={{ height: 0, marginTop: -CARD_OVERLAP }} />;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {showProgress ? (
        <View style={styles.progress}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
              {gifted} of {total} items gifted
            </Text>
            <Text variant="footnote" tone="tertiary" style={{ fontVariant: ["tabular-nums"] }}>
              {Math.round(completion * 100)}%
            </Text>
          </View>
          <ProgressBar value={completion} color={theme.success} />
        </View>
      ) : null}
      {rows.map(({ key, ...row }, index) => (
        <View key={key}>
          {index > 0 || showProgress ? <Divider /> : null}
          <SummaryRow {...row} />
        </View>
      ))}
    </View>
  );
}

/** "Filled in details for 2 items", or "3 items to check" when there's more than one kind. */
function checkLabel(review: number, missing: number, plain: number) {
  const kinds = [review, missing, plain].filter((n) => n > 0).length;
  if (kinds > 1) return `${review + missing + plain} items to check`;
  if (review > 0) return review === 1 ? "Check 1 item's new details" : `Check ${review} items' new details`;
  if (missing > 0) return missing === 1 ? "1 item has no photo or price" : `${missing} items have no photo or price`;
  return plain === 1 ? "1 item has a plain store link" : `${plain} items have plain store links`;
}

interface RowProps {
  key: string;
  icon: IconName;
  label: string;
  detail?: string;
  badge?: number;
  onPress: () => void;
  /** Shows an × that hides the row for good. */
  onDismiss?: () => void;
}

function SummaryRow({ icon, label, detail, badge, onPress, onDismiss }: Omit<RowProps, "key">) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${detail ? `, ${detail}` : ""}${badge ? `, ${badge} new` : ""}`}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceAlt : "transparent" }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme.surfaceAlt }]}>
        <Icon name={icon} size={15} color={theme.textSecondary} />
      </View>
      <Text variant="subhead" numberOfLines={1} style={{ flex: 1 }}>
        {label}
        {detail ? <Text variant="subhead" tone="tertiary">{` · ${detail}`}</Text> : null}
      </Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.tint }]}>
          <Text variant="caption" style={{ color: theme.onTint, fontWeight: "700" }}>
            {badge}
          </Text>
        </View>
      ) : null}
      {onDismiss ? (
        <IconButton icon="close" accessibilityLabel={`Hide “${label}”`} onPress={onDismiss} />
      ) : (
        <Icon name="chevronRight" size={14} color={theme.textTertiary} />
      )}
    </Pressable>
  );
}

/** Gift funds, after the items: the guest page lists them with the items too. */
function FundsSection({ detail, onAdd }: { detail: RegistryDetail; onAdd: () => void }) {
  return (
    <View>
      <View style={[styles.sectionHeader, { alignItems: "center" }]}>
        <Text variant="headline" style={{ fontFamily: fonts.displayMedium }}>
          Gift funds
        </Text>
        <Button title="Add" icon="add" size="small" variant="ghost" onPress={onAdd} />
      </View>
      {detail.funds.map((fund, index) => (
        <GroupRow key={fund.id} first={index === 0} last={index === detail.funds.length - 1}>
          <FundRow fund={fund} gifts={detail.gifts.filter((g) => g.cash_fund_id === fund.id)} />
        </GroupRow>
      ))}
    </View>
  );
}

/** A gift fund, as the website's fund card shows it (src/components/cash-fund-card.tsx). Tap to edit. */
function FundRow({ fund, gifts }: { fund: CashFund; gifts: Gift[] }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the fund to edit it"
      onPress={() => router.push({ pathname: "/fund", params: { registryId: fund.registry_id, fundId: fund.id } })}
      style={({ pressed }) => [styles.fundRow, { backgroundColor: pressed ? theme.surfaceAlt : theme.surface }]}
    >
      <View style={[styles.fundIcon, { backgroundColor: theme.successSoft }]}>
        <Icon name="fund" size={24} color={theme.success} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="subhead" numberOfLines={2} style={{ fontWeight: "500" }}>
          {fund.title}
        </Text>
        {fund.goal_amount ? (
          <>
            <Text variant="footnote">
              {formatDollars(fund.current_amount)} raised of {formatDollars(fund.goal_amount)}
            </Text>
            <ProgressBar value={fund.current_amount / fund.goal_amount} color={theme.success} />
          </>
        ) : fund.current_amount > 0 ? (
          <Text variant="footnote">{formatDollars(fund.current_amount)} raised</Text>
        ) : fund.description ? (
          <Text variant="footnote" tone="tertiary" numberOfLines={2}>
            {fund.description}
          </Text>
        ) : null}
        {/* Counted as the website's fund card counts them. */}
        {gifts.length > 0 ? (
          <View style={{ flexDirection: "row" }}>
            <Pill
              tone="success"
              label={`${gifts[0].buyer_name}${gifts.length > 1 ? ` + ${gifts.length - 1} other${gifts.length > 2 ? "s" : ""}` : ""} contributed`}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bandInner: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  photo: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, marginBottom: 2 },
  eyebrow: { fontWeight: "600", letterSpacing: 0.9, fontSize: 11 },
  pills: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  accessRow: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  hiddenButton: {
    width: 27,
    height: 27,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  access: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
  },
  card: {
    marginTop: -CARD_OVERLAP,
    marginHorizontal: spacing.lg,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#231B18",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  progress: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.lg, paddingRight: spacing.md, minHeight: 48 },
  rowIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
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
  fundRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: "center" },
  fundIcon: { width: 64, height: 64, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  fabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 22,
    height: 50,
    borderRadius: 25,
    shadowColor: "#004659",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
