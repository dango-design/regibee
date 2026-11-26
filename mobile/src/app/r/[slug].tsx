// Someone else's list, as a guest sees it: the website's /r/<slug> page
// (src/app/r/[slug]/page.tsx), from the same loader (loadPublicList in
// src/lib/public-list-page.ts), as a phone screen. Guests reserve an item or
// mark it bought here, and say they bought it or release it later.
//
// `event` and `g` are set when the list was opened from a gift link on the
// guest's invitation (/e/<event>/gifts?g=<token>&to=<list>). They go with the
// loader and the reserve action, so the gift is matched to the guest's RSVP,
// the way the website's event guest cookie does it.
//
// Gift funds, covering an item the owners bought, starting a group gift and
// suggesting an item still happen on the website's page, in the web view.
//
// It sits in the root stack, at the website's own path, so back returns to
// whatever opened it. Signed out, lists still open in the web view, since the
// app's server routes need a signed-in account.

import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Share, View } from "react-native";

import { eventTypeLabel, formatShortEventDate } from "@shared/events";
import { reservationsHiddenText, formatReservedUntil, type MyItemGift } from "@shared/gifts";
import { groupGiftPath } from "@shared/group-gifts";
import type { PublicListItem, PublicListPageData } from "@shared/public-list-page-types";
import { classifyStoreLink, registryStoreFor } from "@shared/retailers";

import { Icon } from "@/components/icon";
import { Notice } from "@/components/notice";
import { GiftSheet, type GiftStep, type ItemShop } from "@/components/public-list/gift-sheet";
import { PublicListHero } from "@/components/public-list/hero";
import { GuestItemCard, type GuestItemActions } from "@/components/public-list/item-card";
import { Button, Card, EmptyState, Field, IconButton, LoadingState, ProgressBar, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { formatDollars } from "@/lib/format";
import { useConfirmGift, usePublicList, type EventLink } from "@/lib/public-list-data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { SITE_URL } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/lib/theme";
import { openSite, openWebView, sitePath } from "@/lib/web";

const PART_LABEL = { host: "You're hosting", yes: "You're going", maybe: "You said maybe", pending: "You haven't replied" } as const;

/** The store names for an item: where it's from, and whether it's on the owners' own registry there. */
function shopFor(item: PublicListItem, page: PublicListPageData): ItemShop {
  if (!item.external_url) return {};
  let host = item.external_url;
  try {
    host = new URL(item.external_url).hostname.replace(/^www\./, "");
  } catch {
    // Not a full address: show it as it is.
  }
  const registryStoreName = page.showStoreRegistries ? registryStoreFor(item.external_url, page.linkedStores)?.name : undefined;
  return { shopName: registryStoreName || classifyStoreLink(item.external_url)?.store.name || host, registryStoreName };
}

/** An event link from the list's page: the host's own event screen, or the guest's invitation. */
function openEvent(href: string) {
  const hosted = href.match(/^\/dashboard\/events\/([^/?#]+)/);
  if (hosted) router.push({ pathname: "/events/[eventId]", params: { eventId: hosted[1] } });
  else openSite(href);
}

export default function PublicListScreen() {
  const { slug, event, g } = useLocalSearchParams<{ slug: string; event?: string; g?: string }>();
  const link: EventLink | null = useMemo(
    () => (typeof event === "string" && event && typeof g === "string" && g ? { event, token: g } : null),
    [event, g],
  );
  const theme = useTheme();
  const { session } = useSession();
  const page = usePublicList(slug, link);
  const pull = usePullToRefresh(page.refetch);
  const confirm = useConfirmGift();
  const [sheet, setSheet] = useState<{ itemId: string; step: GiftStep } | null>(null);
  const [search, setSearch] = useState("");
  const [bannerError, setBannerError] = useState<{ itemId: string; message: string } | null>(null);

  // The website's page for this list. From an invitation, the gift link, so
  // the web view knows who the guest is too.
  const webPath = link
    ? `/e/${encodeURIComponent(link.event)}/gifts?g=${encodeURIComponent(link.token)}&to=${encodeURIComponent(slug)}`
    : `/r/${slug}`;

  // Signed out (or looking around in the demo), the app's server routes
  // won't answer, so the website's page shows instead.
  if (!session) return <Redirect href={{ pathname: "/web", params: { path: sitePath(webPath) } }} />;

  const data = page.data;
  if (data === undefined) {
    if (!page.isError) return <LoadingState />;
    return (
      <EmptyState
        icon="error"
        title="Couldn't load this"
        message={errorMessage(page.error)}
        action={
          <View style={{ gap: spacing.sm, alignItems: "center" }}>
            <Button title="Try again" icon="refresh" variant="secondary" size="medium" onPress={() => page.refetch()} />
            {/* An older website without the app's list loader still has the page. */}
            <Button title="Open the website's page" variant="ghost" size="medium" onPress={() => openWebView(webPath, { replace: true })} />
          </View>
        }
      />
    );
  }
  if (data === null) {
    // The website's not-found page for a list says the same.
    return (
      <EmptyState
        icon="gift"
        title="This link doesn't open a list"
        message="It may have a typo, or the list may be gone. Its owner may also have turned this link off and made a new one. Ask the person who sent it to you for the current link."
      />
    );
  }

  const share = () => {
    const url = `${SITE_URL}/r/${data.registry.slug}`;
    Share.share(Platform.OS === "ios" ? { url } : { message: url });
  };
  const openWeb = () => openWebView(webPath);

  const actions: GuestItemActions = {
    openGift: (item, step) => setSheet({ itemId: item.id, step }),
    cover: openWeb,
    startGroupGift: openWeb,
    openGroupGift: (token) => openSite(groupGiftPath(token)),
  };

  // Reservations this guest hasn't confirmed yet, for the banner.
  const openReservations = data.items.filter((i) => !i.is_parent_purchased && data.myItemGifts[i.id]?.status === "reserved");

  const query = search.trim().toLowerCase();
  const shown = query ? data.items.filter((i) => `${i.title} ${i.notes ?? ""}`.toLowerCase().includes(query)) : data.items;
  const byCategory = new Map<string | null, PublicListItem[]>();
  for (const item of shown) {
    const list = byCategory.get(item.category_id) ?? [];
    list.push(item);
    byCategory.set(item.category_id, list);
  }
  const sections = [
    ...data.categories.map((c) => ({ key: c.id, title: c.name, items: byCategory.get(c.id) ?? [] })),
    { key: "other", title: "Other Items", items: byCategory.get(null) ?? [] },
  ].filter((section) => section.items.length > 0);

  const sheetItem = sheet ? data.items.find((i) => i.id === sheet.itemId) : undefined;
  const empty = data.items.length === 0 && data.cashFunds.length === 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: data.registry.title,
          headerRight: () => <IconButton icon="share" accessibilityLabel="Share the list's link" onPress={share} />,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
        refreshControl={<RefreshControl {...pull} tintColor={theme.tint} />}
      >
        <PublicListHero page={data} />

        {data.hideReservations ? <HiddenNotice page={data} /> : null}
        {data.santaFor ? (
          <Notice
            icon="gift"
            tone="accent"
            title={`You're ${data.santaFor}'s Secret Santa.`}
            message={`If you reserve a gift here, ${data.santaFor} sees “Secret Santa” instead of your name.`}
          />
        ) : null}
        {data.listEvents.length > 0 ? (
          <Notice icon="calendar" tone="tint" title={data.listEvents.length === 1 ? "Event with this list" : "Events with this list"}>
            <View style={{ gap: spacing.sm, paddingLeft: 46 }}>
              {data.listEvents.map((e) => (
                <Pressable key={e.id} accessibilityRole="link" onPress={() => openEvent(e.href)} hitSlop={4}>
                  <Text variant="footnote" tone="tertiary">
                    <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }}>
                      {e.title}
                    </Text>
                    {` · ${e.eventDate ? formatShortEventDate(e.eventDate) : eventTypeLabel(e.eventType)} · ${PART_LABEL[e.part]}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Notice>
        ) : null}
        {data.fellowGuests ? (
          <Notice
            icon="people"
            tone="success"
            title={`You're shopping as a guest of ${data.fellowGuests.eventTitle}`}
            message={`You can see which of the other guests reserved what, so nobody doubles up. ${
              data.fellowGuests.ownerName ? `${data.fellowGuests.ownerName} can't` : "The list's owner can't"
            } see who reserved what until the day after.`}
            secondary={{ title: "Everyone's lists", onPress: () => openSite(`/e/${data.fellowGuests!.eventSlug}`) }}
          />
        ) : null}

        {openReservations.map((item) => (
          <ReservationBanner
            key={item.id}
            item={item}
            gift={data.myItemGifts[item.id]}
            busy={confirm.isPending && confirm.variables === data.myItemGifts[item.id].purchaseId}
            error={bannerError?.itemId === item.id ? bannerError.message : null}
            onBought={() => {
              setBannerError(null);
              confirm.mutate(data.myItemGifts[item.id].purchaseId, {
                onSuccess: () => setSheet({ itemId: item.id, step: "done" }),
                onError: (e) => setBannerError({ itemId: item.id, message: errorMessage(e) }),
              });
            }}
            onBuy={() => setSheet({ itemId: item.id, step: "buy" })}
            onRelease={() => setSheet({ itemId: item.id, step: "release" })}
          />
        ))}

        {empty ? (
          <Text variant="callout" tone="tertiary" style={{ textAlign: "center", paddingVertical: spacing.xl }}>
            This registry doesn&apos;t have any items yet.
          </Text>
        ) : null}

        {data.cashFunds.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="title">Gift Funds</Text>
            {data.cashFunds.map((fund) => (
              <FundCard key={fund.id} fund={fund} given={data.myGifts.funds?.[fund.id]} onContribute={openWeb} />
            ))}
          </View>
        ) : null}

        {data.items.length > 8 ? (
          <Field
            value={search}
            onChangeText={setSearch}
            placeholder="Search items"
            accessibilityLabel="Search items"
            returnKeyType="search"
            clearButtonMode="while-editing"
            leading={<Icon name="search" size={16} color={theme.textTertiary} />}
          />
        ) : null}
        {query && shown.length === 0 ? (
          <Text variant="callout" tone="tertiary" style={{ textAlign: "center" }}>
            No items match your search.
          </Text>
        ) : null}

        {sections.map((section) => (
          <View key={section.key} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text variant="title">{section.title}</Text>
              <View style={{ borderRadius: radius.pill, backgroundColor: theme.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text variant="caption" tone="secondary">
                  {section.items.length}
                </Text>
              </View>
            </View>
            {section.items.map((item) => (
              <GuestItemCard
                key={item.id}
                item={item}
                gift={data.myItemGifts[item.id]}
                cookieValue={data.myGifts.items?.[item.id]}
                reservedQty={data.reservedCounts[item.id] ?? 0}
                coveredQty={data.coverCounts[item.id] ?? 0}
                claimedBy={data.fellowGuests?.claims[item.id]}
                groupGift={data.groupGifts?.mine[item.id]}
                groupGiftsOn={Boolean(data.groupGifts)}
                selfPurchasedLabel={data.selfPurchasedLabel}
                shop={shopFor(item, data)}
                actions={actions}
              />
            ))}
          </View>
        ))}

        {/* Suggesting an item happens on the website's page for now. */}
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <Button title="Suggest an item" icon="add" variant="secondary" size="medium" onPress={openWeb} />
        </View>
      </ScrollView>

      {sheet && sheetItem ? (
        <GiftSheet
          key={`${sheet.itemId}:${sheet.step}`}
          item={sheetItem}
          page={data}
          gift={data.myItemGifts[sheetItem.id] ?? null}
          shop={shopFor(sheetItem, data)}
          step={sheet.step}
          link={link}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </>
  );
}

/** Tells the list's owner that what's been reserved is hidden from them. */
function HiddenNotice({ page }: { page: PublicListPageData }) {
  const text = reservationsHiddenText({ turnedOnByExchange: page.hiddenByExchange });
  return (
    <Notice
      icon="eyeSlash"
      tone="neutral"
      title={text.title}
      message={text.why}
      secondary={{
        title: "Change this in settings",
        onPress: () => router.push({ pathname: "/registry/[id]/settings", params: { id: page.registry.id } }),
      }}
    />
  );
}

/**
 * At the top of the list, for a guest with a reservation they haven't
 * confirmed, so coming back from the store, or the next day, they don't have
 * to find the item to finish. The website's ReservationBanner says the same.
 */
function ReservationBanner({
  item,
  gift,
  busy,
  error,
  onBought,
  onBuy,
  onRelease,
}: {
  item: PublicListItem;
  gift: MyItemGift;
  busy: boolean;
  error: string | null;
  onBought: () => void;
  onBuy: () => void;
  onRelease: () => void;
}) {
  return (
    <Notice
      icon="clock"
      tone="accent"
      title={`You reserved the ${item.title}`}
      message={`${gift.reservedUntil ? `It's held for you until ${formatReservedUntil(gift.reservedUntil)}. ` : ""}Did you buy it?`}
    >
      {error ? (
        <Text variant="footnote" tone="danger" style={{ paddingLeft: 46 }}>
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingLeft: 46 }}>
        <Button title="Yes, I bought it" size="small" loading={busy} onPress={onBought} />
        <Button title="Buy it now" size="small" variant="secondary" onPress={onBuy} />
        <Button title="Release" size="small" variant="ghost" onPress={onRelease} />
      </View>
    </Notice>
  );
}

/** A gift fund: how much is raised toward its goal. Contributing happens on the website's page for now. */
function FundCard({
  fund,
  given,
  onContribute,
}: {
  fund: PublicListPageData["cashFunds"][number];
  given?: number;
  onContribute: () => void;
}) {
  const goal = fund.goal_amount && fund.goal_amount > 0 ? fund.goal_amount : null;
  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="headline">{fund.title}</Text>
      {fund.description ? (
        <Text variant="footnote" tone="secondary">
          {fund.description}
        </Text>
      ) : null}
      {goal ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="footnote">{formatDollars(fund.current_amount)} raised</Text>
            <Text variant="footnote">{formatDollars(goal)} goal</Text>
          </View>
          <ProgressBar value={fund.current_amount / goal} />
          <Text variant="caption" tone="tertiary">
            {formatDollars(Math.max(0, goal - fund.current_amount))} remaining
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        {given ? (
          <Button title="Contributed" icon="check" variant="secondary" size="small" disabled />
        ) : (
          <Button title="Contribute" icon="fund" size="small" onPress={onContribute} />
        )}
      </View>
    </Card>
  );
}
