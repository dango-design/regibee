// What the My registries tab shows (src/app/(protected)/dashboard/(tabs)/(overview)/page.tsx).
// The website's page and the phone app (src/app/api/app/data) both load it
// here, so the cards count the same items and gifts.
//
// Server-only: it reads with the service-role client for the signed-in user.

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { countFollowRequests } from "@/lib/follows";
import { formatEventTime, summarizeRsvps } from "@/lib/events";
import { listEventsForUser, listInvitedEventsForUser, listLinkedEventsForUser } from "@/lib/events-server";
import { pickUpcomingEvents } from "@/lib/upcoming-events";
import { getSessionUser } from "@/lib/viewer";
import { coveredQuantity, giftActivityAction, giverNameForOwner, itemAsUnreserved, listProgress, reservationsHiddenFrom } from "@/lib/gifts";
import { itemsHiddenFromOwner, loadPlacements } from "@/lib/list-items";
import { orderLists } from "@/lib/list-order";
import { displayName } from "@/lib/profile-link";
import { profilePhotoUrl } from "@/lib/profile-photos";
import type { DashboardCard, DashboardData, DashboardEvent, DashboardManager } from "@/lib/dashboard-page-types";

export type * from "@/lib/dashboard-page-types";

type CardPurchase = {
  id: string;
  status: string;
  created_at: string;
  buyer_name: string;
  hide_giver?: boolean | null;
  quantity?: number | null;
};
type CardItem = {
  id: string;
  quantity_needed: number;
  quantity_fulfilled: number;
  is_parent_purchased: boolean;
  guests_can_cover?: boolean;
  marked_gifted?: boolean;
  price: number | null;
  purchases: CardPurchase[] | null;
};

// Purchases that still count: everything except cancelled reservations.
function activePurchases(registry: any): CardPurchase[] {
  return ((registry.registry_items as CardItem[] | null) || [])
    .flatMap((item) => item.purchases || [])
    .filter((p) => p.status !== "cancelled");
}

function toCard(
  registry: any,
  viewerId: string,
  hiddenItemIds: Set<string>,
  role: DashboardCard["role"],
  weekAgo: number,
  managers: DashboardManager[],
): DashboardCard {
  // An owner who hides what's been reserved sees nothing reserved yet.
  const hidden = reservationsHiddenFrom(registry, viewerId);
  const allItems = (registry.registry_items as CardItem[] | null) || [];
  const items: CardItem[] = allItems.map((item) =>
    hidden || hiddenItemIds.has(item.id) ? itemAsUnreserved(item) : item
  );
  const visiblePurchases = hidden
    ? []
    : activePurchases({ registry_items: allItems.filter((item) => !hiddenItemIds.has(item.id)) });
  // Covers on an item hidden from the owner stay hidden too.
  const progress = listProgress(items, (item) =>
    hidden || hiddenItemIds.has(item.id) ? 0 : coveredQuantity(item.purchases ?? []),
  );
  const recentPurchases = [...visiblePurchases].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);

  return {
    id: registry.id,
    owner_id: registry.owner_id,
    title: registry.title,
    slug: registry.slug,
    event_date: registry.event_date ?? null,
    is_public: Boolean(registry.is_public),
    is_private: Boolean(registry.is_private),
    listed_on_profile: Boolean(registry.listed_on_profile),
    photo_url: registry.photo_url ?? null,
    registry_type: registry.registry_type || "baby",
    event_type: registry.event_type ?? null,
    honoree_names: registry.honoree_names ?? null,
    settings: registry.settings ?? null,
    created_at: registry.created_at,
    role,
    totalItems: items.length,
    fulfilledItems: progress.gifted,
    progress,
    totalValue: items.reduce((sum, item) => sum + (item.price || 0), 0),
    recentActivity: recentPurchases.map((p) => ({ id: p.id, name: giverNameForOwner(p), action: giftActivityAction(p) })),
    giftsThisWeek: visiblePurchases.filter((p) => Date.parse(p.created_at) >= weekAgo).length,
    reservationsHidden: hidden,
    managers,
  };
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const CARD_ITEM_FIELDS =
  "id, quantity_needed, quantity_fulfilled, is_parent_purchased, guests_can_cover, marked_gifted, price, purchases(id, status, reserved_until, created_at, buyer_name, hide_giver, quantity)";

/**
 * Adds the items placed on each list from its owner's other lists
 * (src/lib/list-items.ts), so the cards count every item on the list. Also
 * returns the items whose gifts are hidden from this person because another
 * list they're on hides what's been reserved from its owner.
 */
async function withPlacedItems(registries: any[], viewerId: string): Promise<Set<string>> {
  const placements = await loadPlacements(registries.map((r) => r.id as string)).catch(() => []);
  if (placements.length === 0) return new Set();

  const ids = [...new Set(placements.map((p) => p.item_id))];
  const [{ data: placedItems }, hiddenItemIds] = await Promise.all([
    supabaseAdmin.from("registry_items").select(`registry_id, ${CARD_ITEM_FIELDS}`).in("id", ids),
    itemsHiddenFromOwner(ids, viewerId).catch(() => new Set<string>()),
  ]);
  const byId = new Map((placedItems ?? []).map((item: any) => [item.id as string, item]));
  const byList = new Map(registries.map((r) => [r.id as string, r]));
  for (const p of placements) {
    const registry = byList.get(p.registry_id);
    const item = byId.get(p.item_id);
    if (!registry || !item || item.registry_id === p.registry_id) continue;
    registry.registry_items = [...(registry.registry_items ?? []), item];
  }
  return hiddenItemIds;
}

// What each registry card needs: the registry, its items, and their purchases.
// The items are the ones whose registry_id is this registry. Naming that link
// matters: registry_item_placements also joins registries and items, and
// without the name Supabase refuses the query as ambiguous (PGRST201).
const REGISTRY_CARD_FIELDS = `
  *,
  registry_items!registry_items_registry_id_fkey(${CARD_ITEM_FIELDS})
`;

// Registries the user helps manage but doesn't own. Pending email invites are
// accepted first, so a registry from a new invite shows up on this visit.
async function loadSharedRegistries(supabase: ServerClient, user: User) {
  if (user.email) {
    const { data: pendingInvites } = await supabaseAdmin
      .from("registry_invites")
      .select("token")
      .eq("email", user.email)
      .gt("expires_at", new Date().toISOString());

    // With the user's own session: the function adds auth.uid() and ignores
    // p_user_id, so the service-role client would add nobody.
    for (const invite of pendingInvites || []) {
      await supabase.rpc("accept_registry_invite", {
        p_token: invite.token,
        p_user_id: user.id,
      });
      // Errors (already a manager, fully used, etc.) are ignored
    }
  }

  const { data: managedEntries } = await supabaseAdmin
    .from("registry_managers")
    .select("registry_id")
    .eq("user_id", user.id)
    .eq("role", "manager");

  const managedRegistryIds = (managedEntries || []).map((e) => e.registry_id);
  if (managedRegistryIds.length === 0) return [];

  const { data } = await supabase
    .from("registries")
    .select(REGISTRY_CARD_FIELDS)
    .in("id", managedRegistryIds)
    .order("created_at", { ascending: false });
  return (data || []).filter((registry) => registry.owner_id !== user.id);
}

/**
 * Everyone else who manages each list, owner first, then co-managers in the
 * order they joined. A list only the viewer manages gets none. A failure
 * leaves every list with none, rather than failing the tab.
 */
async function loadOtherManagers(registryIds: string[], viewerId: string): Promise<Map<string, DashboardManager[]>> {
  const byList = new Map<string, DashboardManager[]>();
  if (registryIds.length === 0) return byList;
  const { data: rows, error } = await supabaseAdmin
    .from("registry_managers")
    .select("registry_id, user_id, role, created_at")
    .in("registry_id", registryIds)
    .neq("user_id", viewerId)
    .order("created_at");
  if (error || !rows || rows.length === 0) return byList;

  const userIds = [...new Set(rows.map((row) => row.user_id as string))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, public_id, full_name, avatar_url")
    .in("id", userIds);
  const people = new Map(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      { name: displayName(profile), photoUrl: profilePhotoUrl(profile) } satisfies DashboardManager,
    ]),
  );

  const sorted = [...rows].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  for (const row of sorted) {
    const person = people.get(row.user_id as string) ?? { name: displayName({ full_name: null }), photoUrl: null };
    byList.set(row.registry_id as string, [...(byList.get(row.registry_id as string) ?? []), person]);
  }
  return byList;
}

/** The order the person chose for their lists, or null. Null too until 20261128085244_list_order.sql has run. */
async function loadListOrder(supabase: ServerClient, userId: string): Promise<string[] | null> {
  const { data, error } = await supabase.from("profiles").select("list_order").eq("id", userId).maybeSingle();
  return error ? null : ((data?.list_order as string[] | null) ?? null);
}

/**
 * "Coming up": the soonest events the user hosts or co-hosts, other people's
 * events they're invited to, and other people's events that link their lists,
 * as the Events tab lists them. An event that's in more than one keeps its
 * first entry, so one you're invited to that links your list shows your
 * reply, as on the Events tab.
 */
async function loadUpcomingEvents(user: User, today: string): Promise<DashboardEvent[]> {
  const [hosted, invited, linked] = await Promise.all([
    listEventsForUser(user.id),
    // Invitations to the account's email count only once it's confirmed.
    listInvitedEventsForUser({ id: user.id, email: user.email_confirmed_at ? (user.email ?? null) : null }),
    listLinkedEventsForUser(user.id),
  ]);
  return pickUpcomingEvents(
    [
      ...hosted.map((event) => {
        const { guests, attending, maybe, pending } = summarizeRsvps(event.event_guests);
        return {
          id: event.id,
          slug: event.slug,
          title: event.title,
          eventType: event.event_type,
          eventDate: event.event_date,
          time: formatEventTime(event),
          role: "host" as const,
          summary: { guests, attending, maybe, pending },
        };
      }),
      ...invited.map((event) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        eventType: event.event_type,
        eventDate: event.event_date,
        time: formatEventTime(event),
        role: "guest" as const,
        summary: null,
        rsvp: event.rsvp_status,
        guestToken: event.guest_token,
      })),
      ...linked.map((event) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        eventType: event.event_type,
        eventDate: event.event_date,
        // The tab's "Celebrating you" list shows only the date.
        time: null,
        role: "celebrating" as const,
        summary: null,
      })),
    ],
    today,
  );
}

/** Loads the My registries tab for the signed-in user. Null when signed out. */
export async function loadDashboard(): Promise<DashboardData | null> {
  // The top bar and the tabs look up the same user, and the lookup is cached
  // per request.
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  if (!user) return null;

  // Dates are YYYY-MM-DD in UTC, like the Following tab's (following/page.tsx).
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // None of these needs another's result, so they run at the same time.
  // The page waits for the slowest one, not for all of them in a row.
  const [{ data: registries }, sharedRegistries, followRequestCount, upcomingEvents, listOrder] = await Promise.all([
    supabase
      .from("registries")
      .select(REGISTRY_CARD_FIELDS)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    loadSharedRegistries(supabase, user),
    user.is_anonymous ? 0 : countFollowRequests(user.id),
    // Guests (anonymous sessions) can't plan events. A failure here leaves
    // "Coming up" out rather than the whole tab.
    user.is_anonymous
      ? []
      : loadUpcomingEvents(user, today).catch((error) => {
          console.error("[dashboard] Failed to load upcoming events:", error);
          return [];
        }),
    loadListOrder(supabase, user.id),
  ]);

  const owned = registries || [];
  const [hiddenItemIds, managers] = await Promise.all([
    withPlacedItems([...owned, ...sharedRegistries], user.id),
    loadOtherManagers(
      [...owned, ...sharedRegistries].map((registry) => registry.id as string),
      user.id,
    ),
  ]);

  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  // An item on several lists counts its gifts once.
  const giftsThisWeek = new Set(
    [...owned, ...sharedRegistries]
      .flatMap((registry) =>
        reservationsHiddenFrom(registry, user.id)
          ? []
          : activePurchases({
              registry_items: ((registry.registry_items as CardItem[] | null) || []).filter(
                (item) => !hiddenItemIds.has(item.id),
              ),
            }),
      )
      .filter((p) => Date.parse(p.created_at) >= weekAgo)
      .map((p) => p.id),
  ).size;

  const card = (registry: any, role: DashboardCard["role"]) =>
    toCard(registry, user.id, hiddenItemIds, role, weekAgo, managers.get(registry.id) ?? []);
  const ownedCards = owned.map((registry) => card(registry, "owner"));
  const sharedCards = sharedRegistries.map((registry) => card(registry, "manager"));

  return {
    owned: ownedCards,
    shared: sharedCards,
    // Newest first, until the person puts them in their own order.
    lists: orderLists(
      [...ownedCards, ...sharedCards].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      listOrder,
    ),
    giftsThisWeek,
    followRequestCount,
    // Until one of their registries is on their profile, the profile link has
    // nothing on it to share.
    showProfilePrompt: !user.is_anonymous && owned.length > 0 && !owned.some((registry) => registry.listed_on_profile),
    upcomingEvents,
    today,
  };
}
