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
}

const MAX_TITLE_LENGTH = 300;
const MAX_URL_LENGTH = 2000;
const MAX_NOTES_LENGTH = 1000;
const MAX_PRICE = 100_000;
const MAX_QUANTITY = 99;

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

  return {
    // Kept as the shop wrote it. A link that isn't a web address is dropped, and the item stays.
    url: webUrl(value.url, ["https:", "http:"]),
    title,
    price,
    imageUrl: webUrl(value.imageUrl, ["https:"]),
    quantity,
    notes,
    isEssential: value.isEssential === true,
  };
}
