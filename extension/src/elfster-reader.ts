// Reads the Elfster wishlist the owner has open, for the popup's import
// screen. The popup runs it in the page with chrome.scripting.executeScript
// only after the owner clicks the toolbar button, so the extension needs no
// access to elfster.com and never reads it on its own.
//
// Elfster's page shows each wish's name, price and picture, but not its
// link. Its own API has all of them, so this asks the API the page itself
// uses, from the page, as the person signed in there:
//
//   GET /v1/wishlists/<id>                        → { title, … }
//   GET /v1/wishlists/<id>/wishes?limit=&offset=  → [{ title, sourceUrl, … }]
//
// Checked on a real wishlist of 26 wishes. Each wish has `sourceUrl`, the
// shop's own page, and `url`, Elfster's tracking link to it. Only
// `sourceUrl` is used.
//
// It also reads how many of each wish have been bought (`quantityPurchased`)
// and received (`quantityReceived`), for keeping a Regibee list in sync
// (src/lib/wishlist-import.ts). Elfster doesn't show owners what's been
// bought for them, so the popup never shows `given` either. It goes only to
// the server, which uses it for guests.
//
// Chrome copies this function into the page by its source text, so it must
// not use anything from outside its own body: no imports, no shared helpers.
// Types are fine, since they're gone by then.

import type { ImportItem } from "@/lib/wishlist-import";

export interface WishlistPage {
  /** False when the page isn't one wishlist on elfster.com. */
  isWishlist: boolean;
  /** The id in the wishlist's address. */
  wishlistId: string | null;
  /** The wishlist's name on Elfster, when it could be read. */
  title: string | null;
  items: ImportItem[];
  /**
   * Every wish, for a sync, the received ones included. The import offers
   * only the ones in `items`.
   */
  wishes: ImportItem[];
  /** Wishes left out of `items` because the owner marked them as received. */
  received: number;
  /** True when Elfster didn't answer, or answered something this can't read. */
  failed: boolean;
}

export async function readElfsterWishlist(): Promise<WishlistPage> {
  const page: WishlistPage = { isWishlist: false, wishlistId: null, title: null, items: [], wishes: [], received: 0, failed: false };
  // The same page isElfsterWishlistUrl (src/lib/wishlist-import.ts) accepts.
  if (location.protocol !== "https:" || !/(^|\.)elfster\.com$/i.test(location.hostname)) return page;
  const id = location.pathname.match(
    /\/wish-lists\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\/|$)/i
  )?.[1];
  if (!id) return page;
  page.isWishlist = true;
  page.wishlistId = id.toLowerCase();

  const PAGE_SIZE = 100;
  const MAX_PAGES = 10;
  const clean = (text: unknown) => (typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "");
  const link = (raw: unknown, protocols: string[]) => {
    if (typeof raw !== "string" || !raw.trim() || raw.length > 2000) return null;
    try {
      return protocols.includes(new URL(raw.trim()).protocol) ? raw.trim() : null;
    } catch {
      return null;
    }
  };
  const get = async (path: string): Promise<unknown> => {
    const response = await fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Elfster answered ${response.status}.`);
    return response.json();
  };

  // The name is only for show. The import works without it.
  try {
    const list = (await get(`/v1/wishlists/${id}`)) as { title?: unknown } | null;
    page.title = clean(list?.title) || null;
  } catch {
    page.title = null;
  }

  type Wish = Record<string, unknown>;
  const wishes: Wish[] = [];
  const seen = new Set<string>();
  try {
    for (let index = 0; index < MAX_PAGES; index++) {
      const batch = await get(`/v1/wishlists/${id}/wishes?limit=${PAGE_SIZE}&offset=${index * PAGE_SIZE}`);
      if (!Array.isArray(batch)) throw new Error("Elfster's answer wasn't a list.");
      let fresh = 0;
      for (const wish of batch as Wish[]) {
        if (!wish || typeof wish !== "object") continue;
        const wishId = typeof wish.wishId === "string" ? wish.wishId : `${wishes.length}`;
        if (seen.has(wishId)) continue;
        seen.add(wishId);
        wishes.push(wish);
        fresh++;
      }
      // A short page is the last one. No new wishes means the offset was ignored.
      if (batch.length < PAGE_SIZE || fresh === 0) break;
    }
  } catch {
    page.failed = true;
    return page;
  }

  for (const wish of wishes) {
    const title = clean(wish.title).slice(0, 300);
    if (!title) continue;
    const wanted = typeof wish.quantity === "number" && Number.isInteger(wish.quantity) ? wish.quantity : 1;
    const quantity = Math.min(Math.max(wanted, 1), 99);
    const count = (raw: unknown) => (typeof raw === "number" && Number.isInteger(raw) ? Math.min(Math.max(raw, 0), 99) : 0);
    const received = count(wish.quantityReceived);
    const price = wish.price && typeof wish.price === "object" ? (wish.price as Record<string, unknown>) : null;
    const amount = price && typeof price.amount === "number" && Number.isFinite(price.amount) ? price.amount : null;
    // Regibee's prices are in US dollars.
    const inDollars = !price?.currency || price.currency === "USD";
    const notes = typeof wish.description === "string" ? wish.description.trim().slice(0, 1000) : "";
    const item = {
      url: link(wish.sourceUrl, ["https:", "http:"]),
      title,
      price: amount !== null && amount > 0 && inDollars ? Math.round(amount * 100) / 100 : null,
      // Elfster's placeholder picture isn't the item's.
      imageUrl: wish.imageUrlIsDefault === true ? null : link(wish.imageUrl, ["https:"]),
      quantity,
      notes: notes || null,
      isEssential: wish.isMostWanted === true,
      wishId: typeof wish.wishId === "string" && wish.wishId.length <= 100 ? wish.wishId : null,
      received,
      given: Math.max(count(wish.quantityPurchased), received),
    };
    page.wishes.push(item);
    // Already received: the owner doesn't want another.
    if (received >= quantity) page.received++;
    else page.items.push(item);
  }
  return page;
}
