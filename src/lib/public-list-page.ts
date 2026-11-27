// What a list's public page loads, for the website's page (/r/<slug>) and the
// phone app's list screen (through /api/app/data). Both show the same thing
// to the same person.
//
// Registry data is read with the service-role client, always filtered by the
// slug in the link. Anonymous database clients have no read access to these
// tables (see supabase/migrations/009_restrict_registry_reads.sql), so the
// full list of registries can't be pulled with the public anon key. The
// result holds only what the page shows: not the owner's id or email, the
// store registry links or the settings, and never a gift idea.
//
// The loader reads no cookies. The website's page reads the guest's gifts
// and the event guest from its cookies and passes them in. The app passes
// the purchase ids it keeps on the phone, and the event and RSVP token of the
// invitation it came from.

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { EventGuestContext } from "@/lib/event-guest-cookie";
import {
  canManageRegistry,
  eventGuestFromToken,
  eventIncludesRegistry,
  getGiftExchange,
} from "@/lib/events-server";
import { exchangeKind } from "@/lib/events";
import { isUuid } from "@/lib/extension";
import { verifyBuyerLink } from "@/lib/buyer-link";
import type { PaymentMethods, RegistrySettings, RegistryType } from "@/lib/types";
import { copyForRegistry, honoreeDisplayName } from "@/lib/registry-copy";
import { headerChoice } from "@/lib/list-headers";
import { displayName, profilePath } from "@/lib/profile-link";
import { getViewer, getViewerRelation, giftProfileViewer } from "@/lib/viewer";
import { parseRetailerRegistries, type StoreId } from "@/lib/retailers";
import {
  fundAsUnpledged,
  fundsPosition,
  isExpiredReservation,
  isOpenReservation,
  itemAsUnreserved,
  listProgress,
  readReservationPrivacy,
  reservationsHiddenFrom,
  toMyItemGift,
  type MyItemGift,
} from "@/lib/gifts";
import { parseGiftProfile, visibleChildGiftProfile, visibleGiftProfile, type GiftProfile } from "@/lib/gift-profile";
import { itemsHiddenFromOwner, loadListItems } from "@/lib/list-items";
import { myGroupGiftsOnItems } from "@/lib/group-gifts-server";
import { accountForEvents, listEventsOnListForViewer } from "@/lib/shared-events-server";
import type { ListEventForViewer } from "@/lib/shared-events";
import type {
  GuestGifts,
  PublicListCategory,
  PublicListFund,
  PublicListItem,
  PublicListPageData,
  PublicListPrefill,
} from "@/lib/public-list-page-types";

const PURCHASE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** What the list loader needs besides the page's own columns. */
interface ListItemColumns {
  registry_id: string;
  sort_order: number;
  created_at: string;
}

/** The list with this slug. Cached, so the page's metadata and the page share one read. */
export const getPublicRegistry = cache(async (slug: string) => {
  const { data } = await supabaseAdmin.from("registries").select("*").eq("slug", slug).single();
  return data;
});

/**
 * A private list opens only for its owner and co-managers. Everyone else gets
 * the not-found page, even with its link or a gift email's signed link.
 */
export async function listHiddenFromViewer(registry: { id: string; is_private: boolean }) {
  if (!registry.is_private) return false;
  const viewer = await getViewer();
  return !(viewer && (await canManageRegistry(viewer.id, registry.id)));
}

/** Who the guest is, as far as the page can tell. */
export interface PublicListGuest {
  /**
   * The guest's own gifts: on the website, what the `regibee_my_gifts` cookie
   * holds; in the app, the purchase ids it keeps on the phone. A purchase id
   * counts only when it matches a live gift on that item.
   */
  gifts?: GuestGifts | null;
  /** The email and signature from a signed buyer link in a guest's gift email. */
  buyer?: { email: string; sig: string } | null;
  /** The guest from an event's gift link, from the website's signed cookie. */
  eventGuest?: EventGuestContext | null;
  /** The same from the app: the event's slug and the guest's RSVP token, checked here. */
  eventLink?: { event: string; token: string } | null;
}

// The events this list is on that the signed-in visitor and the list's owner
// are both invited to, where neither said no. None for the owner, who sees
// every event on their list's dashboard page.
async function loadListEvents(
  registry: { id: string; owner_id: string },
  viewer: { id: string; email?: string | null; email_confirmed_at?: string | null } | null,
): Promise<ListEventForViewer[]> {
  if (!viewer || viewer.id === registry.owner_id) return [];
  try {
    const owner = await accountForEvents(registry.owner_id);
    if (!owner) return [];
    const today = new Date().toISOString().slice(0, 10);
    return await listEventsOnListForViewer(
      registry.id,
      { id: viewer.id, email: viewer.email_confirmed_at ? (viewer.email ?? null) : null },
      owner,
      today,
    );
  } catch (err) {
    console.error("[registry] Failed to load the list's events:", err);
    return [];
  }
}

// Who shared the registry and how the viewer relates to them. The owner stays
// hidden from a viewer they've blocked.
async function loadOwner(listedOnProfile: boolean, ownerId: string) {
  if (!listedOnProfile) return { owner: null, ownerRelation: null };
  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, public_id, full_name")
    .eq("id", ownerId)
    .single();
  if (!ownerProfile) return { owner: null, ownerRelation: null };
  const ownerRelation = await getViewerRelation(ownerProfile.id);
  if (ownerRelation.hidden) return { owner: null, ownerRelation };
  return {
    owner: {
      publicId: ownerProfile.public_id as string,
      path: profilePath(ownerProfile),
      name: displayName(ownerProfile),
    },
    ownerRelation,
  };
}

// The gift profile shown above a personal wishlist's items. A list kept for
// a child has its own, in its settings. Other wishlists show their owner's.
// Baby registries show none. `ownersOwn` says which it is, since the owner
// chooses who sees each part of their own.
async function loadGiftProfile(registry: {
  registry_type: string | null;
  owner_id: string;
  settings: unknown;
}): Promise<{ profile: GiftProfile; ownersOwn: boolean } | null> {
  if (registry.registry_type !== "personal") return null;
  const settings = (registry.settings && typeof registry.settings === "object" ? registry.settings : {}) as Record<
    string,
    unknown
  >;
  if (settings.for_child === true) return { profile: parseGiftProfile(settings.gift_profile), ownersOwn: false };
  // Errors until 20261112062844_gift_profiles_and_birthday_reminders.sql has
  // run, which counts as no profile.
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("gift_profile")
    .eq("id", registry.owner_id)
    .maybeSingle();
  return error ? null : { profile: parseGiftProfile(data?.gift_profile), ownersOwn: true };
}

// A guest who came from a gift link on their event invitation. When their
// event links this registry, or they're the Secret Santa of its owner, the
// gift forms start with their name and email. A Secret Santa also sees a
// notice that the owners won't see their name.
async function loadGuestPrefill(
  registry: { id: string },
  { eventGuest, eventLink }: Pick<PublicListGuest, "eventGuest" | "eventLink">,
): Promise<{
  prefill: PublicListPrefill | null;
  santaFor: string | null;
  eventTitle: string | null;
  /** The guest, when this list is part of their event. */
  guest: EventGuestContext | null;
}> {
  const none = { prefill: null, santaFor: null, eventTitle: null, guest: null };
  try {
    const guest = eventLink
      ? await eventGuestFromToken(eventLink.event, eventLink.token, [registry.id])
      : (eventGuest ?? null);
    if (!guest) return none;
    const isSanta = guest.santa?.registryId === registry.id;
    // The event, when it links this list. A group gift started here shows on
    // its invitation (src/lib/actions/group-gifts.ts).
    let eventTitle: string | null = null;
    let included = false;
    if (isUuid(guest.eventId)) {
      const { data: link } = await supabaseAdmin
        .from("event_registries")
        .select("events(title)")
        .eq("event_id", guest.eventId)
        .eq("registry_id", registry.id)
        .maybeSingle();
      if (link) {
        eventTitle = (link as unknown as { events: { title: string } | null }).events?.title ?? null;
        included = true;
      } else {
        // Or another guest's wishlist, when everyone gives everyone.
        included = await eventIncludesRegistry(guest.eventId, registry.id);
      }
    }
    if (!included && !isSanta) {
      return none;
    }
    return {
      prefill: { name: guest.name, email: guest.email, secretGiver: isSanta },
      santaFor: isSanta ? guest.santa?.gifteeName || null : null,
      eventTitle,
      guest: isSanta ? null : guest,
    };
  } catch (err) {
    console.error("[registry] Failed to read the event guest:", err);
    return none;
  }
}

/**
 * Who's getting what, for a guest of an everyone-gives-everyone event: the
 * names of the event's guests who reserved each item here, so nobody doubles
 * up. Only guests of the same event see them, and only names of guests of
 * that event: a gift is matched to a guest when they reserved it from their
 * invitation (purchases.event_guest_id). Never on the guest's own list, and
 * never a Secret Santa's name. Null when the viewer gets none.
 */
async function loadFellowGuestClaims(
  registry: { id: string; owner_id: string },
  guest: EventGuestContext | null,
  viewerId: string | null,
  itemIds: string[]
): Promise<{
  claims: Record<string, string[]>;
  eventTitle: string;
  eventSlug: string;
  /** The guest whose wishlist this is, when it's a guest's. */
  listOwner: string | null;
  /** The event the guest came from. */
  eventId: string;
} | null> {
  if (!guest || !isUuid(guest.guestId) || viewerId === registry.owner_id) return null;
  try {
    const [{ data: me }, { data: event }, exchange, { data: listOwners }] = await Promise.all([
      supabaseAdmin
        .from("event_guests")
        .select("id, email, wishlist_registry_id")
        .eq("id", guest.guestId)
        .eq("event_id", guest.eventId)
        .maybeSingle(),
      supabaseAdmin.from("events").select("title, slug").eq("id", guest.eventId).maybeSingle(),
      getGiftExchange(guest.eventId),
      supabaseAdmin
        .from("event_guests")
        .select("name")
        .eq("event_id", guest.eventId)
        .eq("wishlist_registry_id", registry.id)
        .limit(1),
    ]);
    // Off the guest list now, or not an everyone-gives-everyone event.
    if (!me || !event || exchangeKind(exchange) !== "everyone") return null;
    if (me.wishlist_registry_id === registry.id) return null;
    // Or another list they added to the event themselves, like their child's.
    const { data: ownMore } = await supabaseAdmin
      .from("event_guest_lists")
      .select("registry_id")
      .eq("guest_id", me.id)
      .eq("registry_id", registry.id)
      .limit(1);
    if ((ownMore?.length ?? 0) > 0) return null;
    if (me.email) {
      const { data: owner } = await supabaseAdmin.auth.admin.getUserById(registry.owner_id);
      if (owner.user?.email?.toLowerCase() === me.email.toLowerCase()) return null;
    }

    const claims: Record<string, string[]> = {};
    const result = {
      claims,
      eventTitle: event.title as string,
      eventSlug: event.slug as string,
      listOwner: (listOwners?.[0]?.name as string | undefined) ?? null,
      eventId: guest.eventId,
    };
    if (itemIds.length === 0) return result;
    const { data: purchases } = await supabaseAdmin
      .from("purchases")
      .select("registry_item_id, event_guest_id, hide_giver, status, reserved_until")
      .in("registry_item_id", itemIds)
      .not("event_guest_id", "is", null)
      .neq("status", "cancelled");
    const live = (purchases || []).filter(
      (p) => !p.hide_giver && !isExpiredReservation(p as { status: string; reserved_until: string | null })
    );
    const guestIds = [...new Set(live.map((p) => p.event_guest_id as string))];
    if (guestIds.length === 0) return result;
    const { data: givers } = await supabaseAdmin
      .from("event_guests")
      .select("id, name")
      .eq("event_id", guest.eventId)
      .in("id", guestIds);
    const names = new Map((givers || []).map((g) => [g.id as string, g.name as string]));
    for (const p of live) {
      // The guest's own gifts already say "Reserved for you".
      if (p.event_guest_id === me.id) continue;
      const name = names.get(p.event_guest_id as string);
      if (!name || !p.registry_item_id) continue;
      const list = (claims[p.registry_item_id] ??= []);
      if (!list.includes(name)) list.push(name);
    }
    return result;
  } catch (err) {
    console.error("[registry] Failed to load what other guests reserved:", err);
    return null;
  }
}

/**
 * Everything the list's public page shows, or null when the viewer can't
 * open it: there's no list with this slug, or it's private and they don't
 * manage it.
 */
export async function loadPublicList(slug: string, guestInput: PublicListGuest = {}): Promise<PublicListPageData | null> {
  const [registry, viewer] = await Promise.all([getPublicRegistry(slug), getViewer()]);
  if (!registry) return null;
  if (await listHiddenFromViewer(registry)) return null;

  // Only registries the owner chose to show on their profile say who owns them,
  // so unlisted ones never point to a profile. The owner lookups don't depend
  // on the items, so both run at the same time.
  const [
    { owner, ownerRelation },
    { data: categories },
    { data: items },
    { data: cashFunds },
    { prefill: guestPrefill, santaFor, eventTitle: guestEventTitle, guest: eventGuest },
    viewerManages,
    fullGiftProfile,
    listEvents,
  ] = await Promise.all([
    loadOwner(Boolean(registry.listed_on_profile), registry.owner_id),
    supabaseAdmin
      .from("categories")
      .select("*")
      .eq("registry_id", registry.id)
      .order("sort_order"),
    // Its own items and the ones its owner placed on it from their other
    // lists, each in its category here (src/lib/list-items.ts).
    loadListItems<PublicListItem & ListItemColumns>(registry.id).then((data) => ({ data })),
    supabaseAdmin
      .from("cash_funds")
      .select("*")
      .eq("registry_id", registry.id),
    loadGuestPrefill(registry, guestInput),
    viewer ? canManageRegistry(viewer.id, registry.id) : Promise.resolve(false),
    loadGiftProfile(registry),
    loadListEvents(registry, viewer),
  ]);

  // The owner's own gift profile shows each part to the people they chose
  // (src/lib/gift-profile.ts), whether or not the list is on their profile.
  // Someone the owner blocked sees none of it. A child's list shows the
  // child's to everyone who opens it, apart from the birthday, which shows
  // only to the owner and the followers they approved, and only while the
  // list is on the owner's profile.
  const giftRelation = fullGiftProfile?.ownersOwn
    ? (ownerRelation ?? (await getViewerRelation(registry.owner_id)))
    : null;
  const giftProfile = !fullGiftProfile
    ? null
    : giftRelation
      ? giftRelation.hidden
        ? {}
        : visibleGiftProfile(fullGiftProfile.profile, giftProfileViewer(giftRelation))
      : visibleChildGiftProfile(fullGiftProfile.profile, {
          birthday:
            (viewer !== null && viewer.id === registry.owner_id) ||
            (Boolean(owner) && ownerRelation?.state === "approved"),
        });
  const showBirthday = Boolean(giftProfile?.birthday);

  // The owner can hide what's been reserved from themselves (src/lib/gifts.ts).
  // When they open their own list's page, it shows nothing reserved, the same
  // as their dashboard. Everyone else sees what's taken.
  const hideReservations = reservationsHiddenFrom(registry, viewer?.id);

  // Only the page's own columns go out, not the list loader's extras.
  const allItems: PublicListItem[] = (items || []).map((i) => ({
    id: i.id,
    title: i.title,
    external_url: i.external_url,
    image_url: i.image_url,
    price: i.price,
    quantity_needed: i.quantity_needed,
    quantity_fulfilled: i.quantity_fulfilled,
    is_essential: i.is_essential,
    is_parent_purchased: i.is_parent_purchased,
    guests_can_cover: i.guests_can_cover ?? true,
    marked_gifted: i.marked_gifted ?? false,
    is_open_to_used: i.is_open_to_used,
    minimum_condition: i.minimum_condition,
    notes: i.notes,
    category_id: i.category_id,
  }));

  // Group gifts (src/lib/group-gifts.ts): anyone but the list's managers can
  // start one, and sees the ones they organize or chipped in on. Managers
  // only ever see an ordinary reservation.
  const myGroupGifts =
    viewer && !viewerManages
      ? await myGroupGiftsOnItems(
          allItems.map((i) => i.id),
          viewer.id,
        ).catch((err) => {
          console.error("[registry] Failed to load group gifts:", err);
          return {};
        })
      : {};
  // A gift belongs to the item, and an item can be on several of the owner's
  // lists. If another of them hides what's been reserved, the owner doesn't
  // see this item's gifts here either.
  const hiddenItemIds =
    viewer && viewer.id === registry.owner_id && !hideReservations
      ? await itemsHiddenFromOwner(allItems.map((i) => i.id), viewer.id).catch(() => new Set<string>())
      : new Set<string>();
  const hidesItem = (id: string) => hideReservations || hiddenItemIds.has(id);
  const allCategories: PublicListCategory[] = ((categories || []) as PublicListCategory[]).map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
  }));
  const allFunds: PublicListFund[] = ((cashFunds || []) as PublicListFund[]).map((fund) => {
    const shown: PublicListFund = {
      id: fund.id,
      title: fund.title,
      description: fund.description,
      goal_amount: fund.goal_amount,
      current_amount: fund.current_amount,
    };
    return hideReservations ? fundAsUnpledged(shown) : shown;
  });
  const parentName = honoreeDisplayName(registry);
  const copy = copyForRegistry(registry);
  const registryType = (registry.registry_type as RegistryType | undefined) || "baby";
  const isBabyRegistry = registryType === "baby";

  const paymentMethods = ((registry.settings as RegistrySettings | null)?.payment_methods as PaymentMethods | undefined) ?? null;

  // Only the store ids go to the browser. The owner's store registry links
  // stay on the server.
  const linkedStores: StoreId[] = isBabyRegistry
    ? parseRetailerRegistries(registry.settings).map((r) => r.store)
    : [];

  // The shipping address is only shown by the reserve dialog, after a guest
  // reserves a regular item, so it's only sent to visitors we can tie to a live
  // reservation here. The gifts cookie is readable and editable in the browser,
  // so it counts only when it holds the purchase id of that reservation; item
  // ids are public, purchase ids aren't. A verified buyer link also counts.
  const reservableItemIds = new Set(
    allItems.filter((i) => !i.is_parent_purchased).map((i) => i.id)
  );
  const allItemIds = new Set(allItems.map((i) => i.id));
  const allFundIds = new Set(allFunds.map((f) => f.id));

  // The guest's gifts on this list. Entries for other lists' items and funds
  // stay out: the page never looks them up.
  const myGifts: GuestGifts = {};
  for (const [itemId, value] of Object.entries(guestInput.gifts?.items ?? {})) {
    if (allItemIds.has(itemId) && typeof value === "string") (myGifts.items ??= {})[itemId] = value;
  }
  for (const [fundId, value] of Object.entries(guestInput.gifts?.funds ?? {})) {
    if (allFundIds.has(fundId) && typeof value === "number") (myGifts.funds ??= {})[fundId] = value;
  }

  // This visitor's own gifts, by item id. Covers of items the owners bought
  // are here too, so the guest can see and undo them, but they never reveal
  // the address: nothing ships.
  const myItemGifts: Record<string, MyItemGift> = {};

  const claimedItemByPurchase = new Map<string, string>();
  for (const [itemId, purchaseId] of Object.entries(myGifts.items ?? {})) {
    if (PURCHASE_ID_PATTERN.test(purchaseId)) claimedItemByPurchase.set(purchaseId, itemId);
  }

  // A visitor who arrived via a signed buyer link sees their purchases for
  // this registry highlighted, along with the ones in their cookie.
  const buyer = guestInput.buyer ?? null;
  let isVerifiedBuyer = false;
  if (buyer) {
    try {
      isVerifiedBuyer = verifyBuyerLink(buyer.email, slug, buyer.sig);
    } catch {
      // Invalid signature — ignore silently
    }
  }

  type PurchaseRow = {
    id: string;
    registry_item_id: string | null;
    cash_fund_id?: string | null;
    quantity?: number | null;
    amount?: number | string | null;
    status: string;
    reserved_until?: string | null;
  };
  type CoverRow = { registry_item_id: string | null; quantity: number | null };
  const noRows = Promise.resolve({ data: [] as PurchaseRow[] });
  // Emails are saved as the guest typed them, so match that and lowercase.
  const buyerEmails = isVerifiedBuyer && buyer ? [...new Set([buyer.email, buyer.email.toLowerCase()])] : null;
  // A Secret Santa's gift row holds no email, so the list's owners can't read
  // it (recordEventGuestOnGift in src/lib/actions/registry.ts). Their email is
  // in secret_givers, which only the server reads.
  const secretPurchaseIds: Promise<string[]> = buyerEmails
    ? Promise.resolve(
        supabaseAdmin.from("secret_givers").select("purchase_id").in("buyer_email", buyerEmails),
      ).then(({ data }) => (data || []).map((row) => row.purchase_id as string))
    : Promise.resolve([]);
  const buyerPurchases = async (
    column: "registry_item_id" | "cash_fund_id",
    ids: string[],
  ): Promise<{ data: PurchaseRow[] | null }> => {
    if (!buyerEmails || ids.length === 0) return { data: [] };
    const columns = "id, registry_item_id, cash_fund_id, amount, status, reserved_until, quantity";
    const secretIds = await secretPurchaseIds;
    const [byEmail, bySecretGiver] = await Promise.all([
      supabaseAdmin
        .from("purchases")
        .select(columns)
        .in("buyer_email", buyerEmails)
        .neq("status", "cancelled")
        .in(column, ids),
      secretIds.length > 0
        ? supabaseAdmin.from("purchases").select(columns).in("id", secretIds).neq("status", "cancelled").in(column, ids)
        : noRows,
    ]);
    return { data: [...((byEmail.data as PurchaseRow[] | null) || []), ...((bySecretGiver.data as PurchaseRow[] | null) || [])] };
  };

  // These lookups only need the items, so they run at the same time.
  const parentPurchasedIds = allItems.filter((i) => i.is_parent_purchased).map((i) => i.id);
  const reservableIds = [...reservableItemIds];
  const [
    { data: coverPurchases },
    { data: claimedPurchases },
    { data: buyerItemPurchases },
    { data: buyerFundPurchases },
    { data: openReservations },
    fellowGuests,
  ] = await Promise.all([
    // How many times each parent-purchased item has been covered
    parentPurchasedIds.length > 0
      ? supabaseAdmin
          .from("purchases")
          .select("registry_item_id, quantity")
          .in("registry_item_id", parentPurchasedIds)
          .neq("status", "cancelled")
      : noRows,
    claimedItemByPurchase.size > 0
      ? supabaseAdmin
          .from("purchases")
          .select("id, registry_item_id, status, reserved_until, quantity")
          .in("id", [...claimedItemByPurchase.keys()])
          .neq("status", "cancelled")
      : noRows,
    buyerPurchases("registry_item_id", allItems.map((i) => i.id)),
    buyerPurchases("cash_fund_id", allFunds.map((f) => f.id)),
    // Reservations still on hold, for the counts below
    reservableIds.length > 0
      ? supabaseAdmin
          .from("purchases")
          .select("id, registry_item_id, quantity, status, reserved_until")
          .in("registry_item_id", reservableIds)
          .eq("status", "reserved")
          .not("reserved_until", "is", null)
      : noRows,
    loadFellowGuestClaims(registry, eventGuest, viewer?.id ?? null, allItems.map((i) => i.id)),
  ]);

  const coverCounts: Record<string, number> = {};
  for (const p of (coverPurchases || []) as CoverRow[]) {
    if (p.registry_item_id) {
      coverCounts[p.registry_item_id] = (coverCounts[p.registry_item_id] || 0) + (p.quantity || 1);
    }
  }

  let hasReservation = false;
  for (const p of (claimedPurchases || []) as PurchaseRow[]) {
    if (p.registry_item_id && claimedItemByPurchase.get(p.id) === p.registry_item_id) {
      if (reservableItemIds.has(p.registry_item_id)) hasReservation = true;
      myItemGifts[p.registry_item_id] = toMyItemGift(p);
    }
  }

  for (const p of [...(buyerItemPurchases || []), ...(buyerFundPurchases || [])] as PurchaseRow[]) {
    if (p.registry_item_id) {
      (myGifts.items ??= {})[p.registry_item_id] = "reserved";
      if (reservableItemIds.has(p.registry_item_id)) hasReservation = true;
      // The signed link proves this visitor is the buyer, so their
      // purchase ids can go to the page for them to finish or release.
      if (!myItemGifts[p.registry_item_id]) myItemGifts[p.registry_item_id] = toMyItemGift(p);
    }
    if (p.cash_fund_id && p.amount) {
      const funds = (myGifts.funds ??= {});
      funds[p.cash_fund_id] = (funds[p.cash_fund_id] || 0) + Number(p.amount);
    }
  }

  // How many of each item are only reserved so far, not bought, so other
  // guests see "Reserved by a guest" rather than "Gifted". A reservation that
  // ran out stays in the database until the daily job releases it, so until
  // then it's taken off the item's count here, and reserving the item
  // releases it (reserveItem). Its own guest still sees it as theirs, so they
  // can say they bought it.
  const reservedCounts: Record<string, number> = {};
  const expiredCounts: Record<string, number> = {};
  const myPurchaseIds = new Set(Object.values(myItemGifts).map((g) => g.purchaseId));
  const now = Date.now();
  for (const p of (openReservations || []) as PurchaseRow[]) {
    if (!p.registry_item_id || !isOpenReservation(p)) continue;
    const counts = isExpiredReservation(p, now) && !myPurchaseIds.has(p.id) ? expiredCounts : reservedCounts;
    counts[p.registry_item_id] = (counts[p.registry_item_id] || 0) + (p.quantity || 1);
  }
  const shownItems = allItems.map((i) =>
    hidesItem(i.id)
      ? itemAsUnreserved(i)
      : expiredCounts[i.id]
        ? { ...i, quantity_fulfilled: Math.max(0, i.quantity_fulfilled - expiredCounts[i.id]) }
        : i
  );
  for (const id of Object.keys(reservedCounts)) {
    if (hidesItem(id)) delete reservedCounts[id];
  }
  for (const id of Object.keys(coverCounts)) {
    if (hidesItem(id)) delete coverCounts[id];
  }

  const shippingAddress = hasReservation
    ? ((registry.settings as RegistrySettings | null)?.shipping_address ?? null)
    : null;

  return {
    registry: {
      id: registry.id,
      slug: registry.slug,
      title: registry.title,
      description: registry.description ?? null,
      photo_url: registry.photo_url ?? null,
      event_date: registry.event_date ?? null,
      honoree_names: registry.honoree_names ?? null,
      parent_names: registry.parent_names ?? null,
      registry_type: registryType,
    },
    header: headerChoice(registry.settings),
    owner,
    ownerRelation: owner && ownerRelation
      ? { state: ownerRelation.state, isOwner: ownerRelation.isOwner, followsYou: ownerRelation.followsYou }
      : null,
    signedIn: Boolean(viewer),
    viewerManages,
    parentName,
    giftProfileName: honoreeDisplayName(registry, owner?.name ?? "this list's owner"),
    selfPurchasedLabel: copy.selfPurchasedLabel,
    coverFlavor: copy.coverItemFlavor(parentName),
    giftProfile,
    showBirthday,
    hideReservations,
    hiddenByExchange: readReservationPrivacy(registry.settings).hide_reservations_source === "exchange",
    categories: allCategories,
    items: shownItems,
    cashFunds: allFunds,
    fundsPosition: fundsPosition(registry.settings),
    paymentMethods,
    shippingAddress,
    linkedStores,
    showStoreRegistries: isBabyRegistry,
    myGifts,
    myItemGifts,
    reservedCounts,
    coverCounts,
    fellowGuests: fellowGuests
      ? {
          claims: fellowGuests.claims,
          eventTitle: fellowGuests.eventTitle,
          eventSlug: fellowGuests.eventSlug,
          ownerName:
            fellowGuests.listOwner ?? (registry.honoree_names?.trim() || registry.parent_names?.trim() || null),
        }
      : null,
    // The fellow guests' notice already names the event this guest came from.
    listEvents: fellowGuests ? listEvents.filter((e) => e.id !== fellowGuests.eventId) : listEvents,
    santaFor,
    guestPrefill,
    groupGifts: viewerManages ? null : { mine: myGroupGifts, eventTitle: guestEventTitle },
    fulfilledItems: listProgress(shownItems, (i) => coverCounts[i.id] || 0).gifted,
    totalItems: shownItems.length,
  };
}
