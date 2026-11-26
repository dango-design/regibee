// The gifts cookie remembers what this browser gave: purchase ids by item id,
// and amounts by cash fund id. The public registry page reads it to show a
// guest their own gifts. It's readable and editable in the browser, so the
// page trusts an item entry only when it holds a live purchase id for that
// item. Purchase ids never appear in public page data.
//
// The phone app keeps its own copy of a guest's gifts (mobile/src/lib/my-gifts.ts)
// and shares it with the website's pages in its web view:
// - When the app opens the web view, it sends its gifts to /api/app/open in
//   the APP_GIFTS_HEADER header. The route adds the ones that match a live
//   gift to this cookie (syncAppGifts), and marks the cookie with the account.
// - The web view reads this cookie after each change and sends the app the
//   gifts it doesn't have yet (webViewGifts, newGifts).
//
// The phone app imports this file too, so it has no imports of its own.

export const MY_GIFTS_COOKIE = "regibee_my_gifts";

export const MY_GIFTS_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: "lax" as const,
  // The app's web view reads it from the page (see above), so it stays
  // readable in the browser.
  httpOnly: false,
};

/**
 * Sent by the app's web view to /api/app/open: the app's gifts, as JSON
 * purchase ids by item id. A header, not the address, since a purchase id is
 * a secret: anyone holding one can confirm or release that gift and see the
 * list's shipping address.
 */
export const APP_GIFTS_HEADER = "x-regibee-gifts";

/** The most gifts the app sends: its newest ones. More wouldn't fit in the cookie. */
export const MAX_APP_GIFTS = 50;

// Browsers drop a cookie whose name and value are over 4,096 bytes, and the
// value is URL-encoded when it's set, so each quote takes 3 bytes. Past this,
// the oldest gifts make room for the newest.
const MAX_COOKIE_VALUE = 3900;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MyGiftsCookie {
  items?: Record<string, string>;
  funds?: Record<string, number>;
  /**
   * In the app's web view only: the account whose gifts these are. Another
   * account signing in on the same phone starts with its own (syncAppGifts).
   */
  account?: string;
}

export function parseMyGiftsCookie(raw: string | undefined): MyGiftsCookie {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data) ? (data as MyGiftsCookie) : {};
  } catch {
    return {};
  }
}

/** The cookie's value for these gifts, without the oldest ones when they'd make it too big to keep. */
export function myGiftsCookieValue(data: MyGiftsCookie): string {
  const items = { ...(data.items ?? {}) };
  const funds = { ...(data.funds ?? {}) };
  const build = () =>
    JSON.stringify({
      ...data,
      ...(data.items || Object.keys(items).length ? { items } : {}),
      ...(data.funds || Object.keys(funds).length ? { funds } : {}),
    });
  let value = build();
  while (encodeURIComponent(value).length + MY_GIFTS_COOKIE.length + 1 > MAX_COOKIE_VALUE) {
    const oldest = Object.keys(items)[0] ?? Object.keys(funds)[0];
    if (oldest === undefined) break;
    if (oldest in items) delete items[oldest];
    else delete funds[oldest];
    value = build();
  }
  return value;
}

/** The cookie's value with one gift added or replaced. The new gift goes last, as the newest. */
export function withGift(
  raw: string | undefined,
  key: "items" | "funds",
  id: string,
  value: string | number
): string {
  const data = parseMyGiftsCookie(raw);
  const entries = { ...(data[key] ?? {}) } as Record<string, string | number>;
  delete entries[id];
  entries[id] = value;
  return myGiftsCookieValue({ ...data, [key]: entries });
}

/** Only the entries that are an item id and a purchase id. */
function purchaseIdsByItem(value: unknown): Record<string, string> {
  const gifts: Record<string, string> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return gifts;
  for (const [itemId, purchaseId] of Object.entries(value)) {
    if (UUID.test(itemId) && typeof purchaseId === "string" && UUID.test(purchaseId)) gifts[itemId] = purchaseId;
  }
  return gifts;
}

/**
 * The gifts the app sent in APP_GIFTS_HEADER: its newest MAX_APP_GIFTS, by
 * item id. Null when there's no header, as from app builds made before it.
 */
export function parseAppGifts(value: string | null | undefined): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return {};
  }
  const entries = Object.entries(purchaseIdsByItem(parsed));
  return Object.fromEntries(entries.slice(-MAX_APP_GIFTS));
}

/** Whether the cookie's gifts count for this account: they're its own, or nobody's yet. */
function keepsCookieGifts(cookie: MyGiftsCookie, account: string): boolean {
  return !cookie.account || cookie.account === account;
}

/** The purchase ids syncAppGifts needs looked up: the app's, and the cookie's when it keeps them. */
export function purchaseIdsToCheck(raw: string | undefined, fromApp: Record<string, string>, account: string): string[] {
  const cookie = parseMyGiftsCookie(raw);
  const ids = new Set(Object.values(fromApp));
  if (keepsCookieGifts(cookie, account)) {
    for (const purchaseId of Object.values(purchaseIdsByItem(cookie.items))) ids.add(purchaseId);
  }
  return [...ids];
}

/**
 * The web view's gifts cookie once the app's gifts are in it, for `account`.
 *
 * - `live` maps each purchase id that's still a gift (not cancelled) to its
 *   item id. A gift counts only when its purchase id is live and on that item,
 *   the same rule the list page uses. Others are dropped.
 * - The cookie's own gifts stay when they're this account's, or nobody's:
 *   gifts given in the web view before the app sent any, or while signed out.
 *   Another account's gifts go, and so do its fund amounts.
 * - Where both have a gift on the same item, the app's wins.
 */
export function syncAppGifts({
  raw,
  fromApp,
  account,
  live,
}: {
  raw: string | undefined;
  fromApp: Record<string, string>;
  account: string;
  live: ReadonlyMap<string, string>;
}): string {
  const cookie = parseMyGiftsCookie(raw);
  const keep = keepsCookieGifts(cookie, account);
  const items: Record<string, string> = {};
  if (keep) {
    for (const [itemId, purchaseId] of Object.entries(purchaseIdsByItem(cookie.items))) {
      if (live.get(purchaseId) === itemId) items[itemId] = purchaseId;
    }
  }
  for (const [itemId, purchaseId] of Object.entries(fromApp)) {
    if (live.get(purchaseId) !== itemId) continue;
    delete items[itemId];
    items[itemId] = purchaseId;
  }
  const funds = keep ? cookie.funds : undefined;
  return myGiftsCookieValue({ items, ...(funds ? { funds } : {}), account });
}

/** Whether the cookie holds an app account's gifts, which signing the web view out removes. */
export function hasAccountGifts(raw: string | undefined): boolean {
  return Boolean(parseMyGiftsCookie(raw).account);
}

/**
 * The gifts in the web view's cookie, from the page's `document.cookie`
 * value for MY_GIFTS_COOKIE (still URL-encoded), when they're this
 * account's. Null for another account's, or a cookie the app never marked.
 */
export function webViewGifts(encoded: string, account: string): Record<string, string> | null {
  let raw: string;
  try {
    raw = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  const cookie = parseMyGiftsCookie(raw);
  if (!account || cookie.account !== account) return null;
  return purchaseIdsByItem(cookie.items);
}

/** The gifts in `current` that weren't in `previous`, or were a different gift. */
export function newGifts(previous: Record<string, string>, current: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(current).filter(([itemId, purchaseId]) => previous[itemId] !== purchaseId));
}
