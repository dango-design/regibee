// What a list's manage page shows (src/app/(protected)/dashboard/registry/[registryId]/page.tsx).
// The website's page and the phone app (src/app/api/app/data) both load it
// here, so they show the same items, gifts and notices.
//
// Server-only: it reads with the service-role client after checking that the
// signed-in user manages the list, or is on the support team
// (loadListPageForSupport).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSupportViewer } from "@/lib/support";
import {
  parseHiddenPlainLinkItems,
  parseRetailerRegistries,
  plainLinksByStore,
  storesWithRegistryLinks,
  } from "@/lib/retailers";
import { buildStorePerks, parseStorePerksState, readyPerkCount, type StorePerksRow } from "@/lib/store-perks";
import { getChecklistProgress } from "@/lib/checklist-matching";
import { copyForRegistry } from "@/lib/registry-copy";
import {
  fundAsRevealed,
  isGiftRevealed,
  itemAsRevealed,
  itemAsUnreserved,
  maskGiverForOwner,
  readReservationPrivacy,
  reservationsHiddenFrom,
} from "@/lib/gifts";
import { formatRevealDate, nextReveal } from "@/lib/reveal";
import { getEventsForReveal, getGiftsRevealedThrough, listEventsForRegistry, type RegistryEventEntry } from "@/lib/events-server";
import { getSessionUser } from "@/lib/viewer";
import { itemsHiddenFromOwner, listsForItems, loadListItems, type ListItem } from "@/lib/list-items";
import { loadItemDetailsState } from "@/lib/item-details-server";
import type {
  ListPageCategory,
  ListPageData,
  ListPageFund,
  ListPageItem,
  ListPagePurchase,
  ListPageSuggestion,
} from "@/lib/list-page-types";

export type * from "@/lib/list-page-types";

// Purchases of this registry's items and gift funds, newest first. Each query
// joins to the registry it belongs to, so Postgres only looks at this
// registry's purchases. Without that filter, it checks the purchases access
// rule against every purchase in the table.
async function loadRegistryPurchases(supabase: SupabaseClient, registryId: string) {
  const [{ data: itemPurchases }, { data: fundPurchases }] = await Promise.all([
    supabase
      .from("purchases")
      .select("*, registry_items!registry_item_id!inner(title, registry_id, price, is_parent_purchased)")
      .eq("registry_items.registry_id", registryId),
    supabase
      .from("purchases")
      .select("*, cash_funds!cash_fund_id!inner(title, registry_id)")
      .eq("cash_funds.registry_id", registryId),
  ]);
  const itemPurchaseIds = new Set((itemPurchases || []).map((p) => p.id));
  return [
    ...(itemPurchases || []).map((p) => ({ ...p, cash_funds: null })),
    ...(fundPurchases || [])
      .filter((p) => !itemPurchaseIds.has(p.id))
      .map((p) => ({ ...p, registry_items: null })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

/**
 * For the items placed on this list from the owner's other lists, and items
 * of this list placed on others: their purchases (the access rules only show
 * purchases of a list's own items), the titles and ids of the other lists
 * each item is on, and, for the owner, the items another list hides gifts on.
 */
async function loadPlacementDetails(
  items: ListItem<{ id: string; registry_id: string; category_id: string | null; sort_order: number; created_at: string }>[],
  registryId: string,
  ownerId: string | null,
) {
  const none = {
    purchases: [] as any[],
    otherListsByItem: new Map<string, string[]>(),
    otherListIdsByItem: new Map<string, string[]>(),
    hiddenItemIds: new Set<string>(),
  };
  if (items.length === 0) return none;

  const lists = await listsForItems(items.map((i) => i.id));
  const shared = [...lists.entries()].filter(([, ids]) => ids.length > 1);
  if (shared.length === 0) return none;

  const placedIds = items.filter((i) => i.placed).map((i) => i.id);
  const otherIds = [...new Set(shared.flatMap(([, ids]) => ids))].filter((id) => id !== registryId);
  const [{ data: placedPurchases }, { data: otherLists }, hiddenItemIds] = await Promise.all([
    placedIds.length > 0
      ? supabaseAdmin
          .from("purchases")
          .select("*, registry_items!registry_item_id!inner(title, registry_id, price, is_parent_purchased)")
          .in("registry_item_id", placedIds)
      : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from("registries").select("id, title").in("id", otherIds),
    ownerId ? itemsHiddenFromOwner(shared.map(([id]) => id), ownerId) : Promise.resolve(new Set<string>()),
  ]);

  const titles = new Map((otherLists ?? []).map((r) => [r.id as string, r.title as string]));
  const otherListsByItem = new Map<string, string[]>();
  const otherListIdsByItem = new Map<string, string[]>();
  for (const [itemId, ids] of shared) {
    const others = ids.filter((id) => id !== registryId);
    otherListsByItem.set(itemId, others.map((id) => titles.get(id)).filter((t): t is string => Boolean(t)));
    otherListIdsByItem.set(itemId, others);
  }
  return {
    purchases: (placedPurchases ?? []).map((p) => ({ ...p, cash_funds: null })),
    otherListsByItem,
    otherListIdsByItem,
    hiddenItemIds,
  };
}

/** This list's purchases and its placed items' purchases, newest first. */
function mergePurchases(own: any[], placed: any[]) {
  if (placed.length === 0) return own;
  const seen = new Set(own.map((p) => p.id));
  return [...own, ...placed.filter((p) => !seen.has(p.id))].sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
  );
}

/**
 * Loads a list's manage page for the signed-in user. Null when they don't
 * manage it (or it doesn't exist), which the page shows as not found.
 */
export async function loadListPage(registryId: string): Promise<ListPageData | null> {
  // The top bar looks up the same user, and the lookup is cached per request.
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()]);
  if (!user) return null;

  // Check if user is a manager of this registry (falls back to owner_id if migration not run)
  let isOwner = false;
  const [{ data: managerRecord, error: managerError }, { data: registry }] = await Promise.all([
    supabaseAdmin
      .from("registry_managers")
      .select("role")
      .eq("registry_id", registryId)
      .eq("user_id", user.id)
      .single(),
    supabase.from("registries").select("*").eq("id", registryId).single(),
  ]);

  if (!registry) return null;

  // Determine access: use registry_managers if available, fall back to owner_id
  if (managerRecord) {
    isOwner = managerRecord.role === "owner";
  } else if (managerError || !managerRecord) {
    // Table may not exist yet (migration not run) — fall back to owner_id
    if (registry.owner_id !== user.id) return null;
    isOwner = true;
  }

  // The owner can hide what's been reserved from themselves (src/lib/gifts.ts).
  // Then the page shows only the gifts revealed after an event the list is
  // linked to (src/lib/reveal.ts): nothing reserved, pledged or given
  // otherwise. Co-managers still see it all.
  const hideReservations = reservationsHiddenFrom(registry, user.id);

  return buildListPage(registry, {
    userId: user.id,
    isAnonymous: Boolean(user.is_anonymous),
    isOwner,
    client: supabase,
    hideReservations,
    hiddenItemsFor: isOwner && registry.owner_id === user.id && !hideReservations ? user.id : null,
  });
}

/**
 * Loads a list's manage page as its owner sees it, for the support team's
 * read-only page (src/app/(protected)/support/lists/[registryId]/page.tsx).
 * Null unless the signed-in account is on the support team, or when the list
 * doesn't exist.
 *
 * With `showHiddenGifts`, it also shows the gifts the owner hid from
 * themselves. The page records each time it does.
 *
 * Not in src/lib/app-loaders.ts: the phone app has no support pages.
 */
export async function loadListPageForSupport(
  registryId: string,
  { showHiddenGifts }: { showHiddenGifts: boolean },
): Promise<{ page: ListPageData; ownerHidesGifts: boolean } | null> {
  if (!(await getSupportViewer())) return null;
  const { data: registry } = await supabaseAdmin.from("registries").select("*").eq("id", registryId).maybeSingle();
  if (!registry) return null;

  const ownerId = registry.owner_id as string;
  const hiddenHere = reservationsHiddenFrom(registry, ownerId);
  const page = await buildListPage(registry, {
    userId: ownerId,
    isAnonymous: false,
    isOwner: true,
    client: supabaseAdmin,
    hideReservations: hiddenHere && !showHiddenGifts,
    hiddenItemsFor: showHiddenGifts || hiddenHere ? null : ownerId,
  });

  // Whether anything on the page is hidden from the owner: this list hides
  // what's been reserved, or an item on it is also on a list that does.
  const ownerHidesGifts =
    hiddenHere ||
    (!showHiddenGifts && (await itemsHiddenFromOwner(page.items.map((i) => i.id), ownerId)).size > 0);
  return { page, ownerHidesGifts };
}

/** Whose view of the list to build, once the caller has checked access. */
interface ListPageViewer {
  /** The signed-in manager, or the owner when the support team opens it. */
  userId: string;
  isAnonymous: boolean;
  isOwner: boolean;
  /** Reads categories, purchases, suggestions and funds. */
  client: SupabaseClient;
  /** Show only revealed gifts, as the owner sees them with reservations hidden. */
  hideReservations: boolean;
  /** Hide the gifts of items that another list hides from this owner. Null to show them. */
  hiddenItemsFor: string | null;
}

async function buildListPage(registry: ListPageData["registry"], viewer: ListPageViewer): Promise<ListPageData> {
  const registryId = registry.id;
  const { client: supabase, hideReservations } = viewer;

  const [
    { data: categories },
    { data: items },
    purchases,
    { data: suggestions },
    { data: cashFunds },
    linkedEvents,
    revealedThrough,
    revealEvents,
    { data: ownerLists },
  ] = await Promise.all([
    supabase.from("categories").select("*").eq("registry_id", registryId).order("sort_order"),
    // Its own items and the ones the owner placed on it from their other
    // lists (src/lib/list-items.ts). The access check above has passed.
    loadListItems<Omit<ListPageItem, "home_registry_id" | "placed" | "otherLists" | "otherListIds">>(registryId).then((data) => ({ data })),
    loadRegistryPurchases(supabase, registryId),
    supabase.from("suggestions").select("*").eq("registry_id", registryId).order("created_at", { ascending: false }),
    supabase.from("cash_funds").select("*").eq("registry_id", registryId).order("created_at"),
    listEventsForRegistry(registryId, viewer.userId),
    hideReservations ? getGiftsRevealedThrough(registryId) : null,
    hideReservations ? getEventsForReveal(registryId) : [],
    // The owner's other lists, which they can add an item to or move it to.
    // Co-managers get none: only a list's owner can put its items elsewhere.
    registry.owner_id === viewer.userId
      ? supabaseAdmin
          .from("registries")
          .select("id, title")
          .eq("owner_id", viewer.userId)
          .neq("id", registryId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const turnedOnByExchange = readReservationPrivacy(registry.settings).hide_reservations_source === "exchange";

  const listItems = items || [];
  const [{ purchases: placedPurchases, otherListsByItem, otherListIdsByItem, hiddenItemIds }, { missingDetails, detailReview }] =
    await Promise.all([
      loadPlacementDetails(listItems, registryId, viewer.hiddenItemsFor),
      // Items the extension can fill in, and what it filled in (src/lib/item-details.ts).
      loadItemDetailsState(listItems, { canEditPlaced: viewer.isOwner }),
    ]);
  // A gift belongs to the item. If another list it's on hides what's been
  // reserved from the owner, this page hides that item's gifts too.
  const hidesItem = (id: string | null | undefined) => hideReservations || (!!id && hiddenItemIds.has(id));

  // With reservations hidden from the owner, only gifts revealed after an
  // event the list is linked to count. The database already keeps the others
  // from the owner; this filter keeps the page right before that rule is in
  // place, and covers items placed here from other lists.
  const mergedPurchases = mergePurchases(purchases, placedPurchases);
  const revealedPurchases = hideReservations
    ? mergedPurchases.filter((p: any) => isGiftRevealed(p.created_at, revealedThrough))
    : [];
  const revealedFor = (key: "registry_item_id" | "cash_fund_id", id: string) =>
    revealedPurchases.filter((p: any) => p[key] === id);
  const today = new Date().toISOString().slice(0, 10);
  const upcomingReveal = hideReservations ? nextReveal(revealEvents) : null;
  const revealInfo = hideReservations
    ? {
        revealedCount: revealedPurchases.filter((p: any) => p.status !== "cancelled").length,
        next: upcomingReveal
          ? { date: formatRevealDate(upcomingReveal.date, today), eventTitle: upcomingReveal.event.title }
          : null,
      }
    : undefined;

  const allItems: ListPageItem[] = listItems.map((item) => ({
    ...(hideReservations
      ? itemAsRevealed(item, revealedFor("registry_item_id", item.id))
      : hidesItem(item.id)
        ? itemAsUnreserved(item)
        : item),
    otherLists: otherListsByItem.get(item.id) ?? [],
    otherListIds: otherListIdsByItem.get(item.id) ?? [],
  }));
  const dismissedChecklistItems = (registry.settings as Record<string, unknown> | null)?.checklist_dismissed as string[] | undefined;
  // A checklist entry such as Diaper Fund counts when the list has a fund by that name.
  const checklistProgress = getChecklistProgress(
    [...allItems.map((i) => i.title), ...((cashFunds || []) as { title: string }[]).map((f) => f.title)],
    dismissedChecklistItems
  );
  const copy = copyForRegistry(registry);

  // A Secret Santa's gift shows "Secret Santa" with no email. It's masked
  // here, on the server, so the giver's name and email never reach the
  // browser or the app.
  const allPurchases = (hideReservations ? revealedPurchases : mergedPurchases.filter((p: any) => !hidesItem(p.registry_item_id))).map(
    (p: any) => ({
      ...maskGiverForOwner(p),
      item_title: p.registry_items?.title || p.cash_funds?.title || "Unknown item",
    }),
  ) as ListPagePurchase[];

  const allSuggestions = (suggestions || []) as ListPageSuggestion[];
  const allFunds = ((cashFunds || []) as ListPageFund[]).map((fund) =>
    hideReservations ? fundAsRevealed(fund, revealedFor("cash_fund_id", fund.id)) : fund,
  );

  const settings = registry.settings as Record<string, any> | null;
  const taxEnabled = settings?.tax_enabled !== false;
  // Store registry notices in the item dialogs are for baby registries only.
  const linkedRegistries = registry.registry_type === "baby" ? parseRetailerRegistries(settings) : undefined;
  // A registry link on any item shows the owner has a registry at that store,
  // even before they link it in settings.
  const registryLinkStores = linkedRegistries ? storesWithRegistryLinks(allItems.map((i) => i.external_url)) : undefined;
  // Items with a plain link at a store where the owner has a registry, minus
  // the ones the owner asked not to be reminded about.
  const hiddenPlainLinkItems = new Set(parseHiddenPlainLinkItems(settings));
  const plainLinkGroups = linkedRegistries
    ? [...plainLinksByStore(allItems, linkedRegistries.map((r) => r.store))]
        .map(([storeId, items]) => ({
          storeId,
          items: items.filter((i) => !hiddenPlainLinkItems.has(i.id)).map((i) => ({ id: i.id, title: i.title })),
        }))
        .filter((group) => group.items.length > 0)
    : [];
  // Store perks: one row per store registry the owner linked or has item links from.
  const perkRows = linkedRegistries
    ? buildStorePerks({
        items: allItems,
        purchases: allPurchases,
        linkedRegistries,
        dueDate: registry.event_date,
        today,
        state: parseStorePerksState(settings),
      })
    : [];
  // Guests (anonymous sessions) can't make events, so they get no prompt to.
  // Once a manager dismisses the prompt, a smaller button in the header takes
  // its place.
  const canPlanEvents = !viewer.isAnonymous;
  const eventPromptDismissed = settings?.event_prompt_dismissed === true;

  return {
    registry,
    isOwner: viewer.isOwner,
    ownerLists: ownerLists ? (ownerLists as { id: string; title: string }[]) : undefined,
    categories: (categories || []) as ListPageCategory[],
    items: allItems,
    funds: allFunds,
    purchases: allPurchases,
    suggestions: allSuggestions,
    pendingSuggestionCount: allSuggestions.filter((s) => s.status === "pending" || s.status === "offering").length,
    hideReservations,
    turnedOnByExchange,
    revealInfo,
    linkedEvents,
    showChecklist: copy.checklistAvailable,
    checklistProgress,
    linkedRegistries,
    storesWithRegistryLinks: registryLinkStores,
    plainLinkGroups,
    missingDetails,
    detailReview,
    perkRows,
    perkEmails: parseStorePerksState(settings).emails,
    readyPerkCount: readyPerkCount(perkRows),
    zipCode: taxEnabled ? (settings?.zip_code as string | undefined) : undefined,
    canPlanEvents,
    eventPromptDismissed,
    showPlanEventButton: canPlanEvents && eventPromptDismissed && linkedEvents.length === 0,
  };
}
