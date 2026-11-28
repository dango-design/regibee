// Bringing a wishlist from another site into Regibee. For now that's Elfster:
// the browser extension reads the wishlist the owner has open
// (extension/src/elfster-reader.ts) and sends its items to
// /api/extension/import.
//
// Unlike a store registry import, an item can link to any shop, or to none.
// This file has no imports, so the unit tests can run it.

/** An item read from a wishlist on another site. */
export interface ImportItem {
  /** The link to the shop's own page, never the other site's tracking link. Null when the wish had none. */
  url: string | null;
  title: string;
  /** In US dollars. Null when the wish had no price, or one in another currency. */
  price: number | null;
  imageUrl: string | null;
  quantity: number;
  /** The owner's note on the wish. */
  notes: string | null;
  /** "Most wanted" on Regibee. */
  isEssential: boolean;
  /** The other site's id for the wish, so a sync finds its item again. Null when it had none. */
  wishId: string | null;
  /** How many the owner marked as received on the other site. They see this there too. */
  received: number;
  /**
   * How many have been bought or received on the other site. Only a sync
   * uses it, and only guests ever see it: the popup never shows it, and the
   * server never sends it back (/api/extension/import/sync).
   */
  given: number;
}

const MAX_TITLE_LENGTH = 300;
const MAX_URL_LENGTH = 2000;
const MAX_NOTES_LENGTH = 1000;
const MAX_PRICE = 100_000;
const MAX_QUANTITY = 99;
const MAX_WISH_ID_LENGTH = 100;

/** The most wishes one sync sends. The reader reads at most 10 pages of 100. */
export const MAX_SYNC_ITEMS = 1000;

const ELFSTER_HOST = /(^|\.)elfster\.com$/i;
// /profile/<user id>/wish-lists/<wishlist id>. The reader has its own copy.
const ELFSTER_WISHLIST_PATH =
  /\/wish-lists\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/i;

/** Where the extension's home screen sends the owner to pick a wishlist. */
export const ELFSTER_WISHLISTS_URL = "https://www.elfster.com/wish-lists";

/** True for the page of one wishlist on elfster.com. */
export function isElfsterWishlistUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && ELFSTER_HOST.test(url.hostname) && ELFSTER_WISHLIST_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * How an item with no link is matched against the list: by its name,
 * ignoring case and spacing. Items with a link match on the link
 * (importItemKey in src/lib/extension.ts).
 */
export function titleKey(title: string | null | undefined): string | null {
  const name = (title ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return name ? `title:${name}` : null;
}

function webUrl(raw: unknown, protocols: string[]): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  try {
    return protocols.includes(new URL(trimmed).protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

/** Checks an item that came from the extension. Returns null when it's unusable. */
export function parseImportItem(raw: unknown): ImportItem | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;

  const title =
    typeof value.title === "string" ? value.title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH) : "";
  if (!title) return null;

  const price =
    typeof value.price === "number" && Number.isFinite(value.price) && value.price > 0 && value.price <= MAX_PRICE
      ? Math.round(value.price * 100) / 100
      : null;
  const quantity =
    typeof value.quantity === "number" && Number.isInteger(value.quantity)
      ? Math.min(Math.max(value.quantity, 1), MAX_QUANTITY)
      : 1;
  const notes =
    typeof value.notes === "string" && value.notes.trim() ? value.notes.trim().slice(0, MAX_NOTES_LENGTH) : null;
  const wishId =
    typeof value.wishId === "string" && value.wishId.trim() && value.wishId.trim().length <= MAX_WISH_ID_LENGTH
      ? value.wishId.trim()
      : null;
  const count = (raw: unknown) =>
    typeof raw === "number" && Number.isInteger(raw) ? Math.min(Math.max(raw, 0), MAX_QUANTITY) : 0;

  return {
    // Kept as the shop wrote it. A link that isn't a web address is dropped, and the item stays.
    url: webUrl(value.url, ["https:", "http:"]),
    title,
    price,
    imageUrl: webUrl(value.imageUrl, ["https:"]),
    quantity,
    notes,
    isEssential: value.isEssential === true,
    wishId,
    received: count(value.received),
    given: count(value.given),
  };
}

// ── Keeping a list in sync ──────────────────────────────────────────────
//
// A list can be kept in sync with the owner's Elfster wishlist. Each time
// the owner opens the extension on the wishlist, it sends every wish, and
// the server saves which item each wish is and how many of it have been
// given on Elfster (elfster_wishes, 20261128070237_elfster_sync.sql). The
// guest page counts those as taken. Managers never see them.

/** An item on the list, as a sync sees it. */
export interface SyncListItem {
  id: string;
  title: string;
  url: string | null;
}

/** An item already matched to a wish, from elfster_wishes. */
export interface SyncedWish {
  itemId: string;
  wishId: string;
}

export interface WishlistSyncPlan {
  /** Each item matched to a wish, with how many have been given on Elfster. */
  matched: { itemId: string; wishId: string; given: number }[];
  /** Items matched to a wish before that's no longer on the wishlist. */
  gone: SyncListItem[];
}

/**
 * Matches a wishlist's wishes to a list's items. A wish keeps the item it
 * was matched to before, while that item is on the list. Otherwise it takes
 * the first item with the same link, or the same name when it has no link,
 * that no other wish has. `keyOf` is importItemKey (src/lib/extension.ts).
 */
export function planWishlistSync(
  wishes: ImportItem[],
  listItems: SyncListItem[],
  synced: SyncedWish[],
  keyOf: (item: { url: string | null; title: string | null }) => string | null,
): WishlistSyncPlan {
  const onList = new Map(listItems.map((item) => [item.id, item]));
  const itemForWish = new Map<string, string>();
  for (const row of synced) {
    if (onList.has(row.itemId) && !itemForWish.has(row.wishId)) itemForWish.set(row.wishId, row.itemId);
  }
  const taken = new Set(itemForWish.values());
  const byKey = new Map<string, string[]>();
  for (const item of listItems) {
    const key = keyOf(item);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), item.id]);
  }

  const matched: WishlistSyncPlan["matched"] = [];
  const seenWishes = new Set<string>();
  for (const wish of wishes) {
    if (!wish.wishId || seenWishes.has(wish.wishId)) continue;
    seenWishes.add(wish.wishId);
    let itemId = itemForWish.get(wish.wishId);
    if (!itemId) {
      const key = keyOf(wish);
      itemId = (key && byKey.get(key)?.find((id) => !taken.has(id))) || undefined;
      if (!itemId) continue;
      taken.add(itemId);
    }
    matched.push({ itemId, wishId: wish.wishId, given: Math.max(wish.given, wish.received) });
  }

  const matchedItems = new Set(matched.map((m) => m.itemId));
  const gone: SyncListItem[] = [];
  for (const row of synced) {
    const item = onList.get(row.itemId);
    if (item && !seenWishes.has(row.wishId) && !matchedItems.has(item.id) && !gone.includes(item)) gone.push(item);
  }
  return { matched, gone };
}

/**
 * How many of an item a guest sees as taken: its gifts on Regibee and what's
 * been given on Elfster, up to how many the owner wants. Only for people who
 * don't manage the list.
 */
export function takenForGuests(quantityNeeded: number, quantityFulfilled: number, givenElsewhere: number): number {
  return Math.min(Math.max(quantityNeeded, quantityFulfilled), quantityFulfilled + Math.max(0, givenElsewhere));
}
