// The gifts this account reserved from the app's list screen, kept on the
// phone: purchase ids by item id. The website keeps the same thing in its
// `regibee_my_gifts` cookie. A purchase id is the guest's proof that a gift is
// theirs: with it they can say they bought it or release it, and see the
// shipping address. The list loader only counts an id that matches a live
// gift on that item, so an old one does no harm.
//
// Kept per account, so someone else signing in on the same phone doesn't see
// them. Signing out leaves them, like the website's cookie.
//
// The website's pages in the web view (src/app/web.tsx) share them both ways:
// the web view hands these to the website when it opens, and the gifts given
// on a page there come back here. The rules are in the website's
// src/lib/my-gifts-cookie.ts.

import { kvStorage } from "@/lib/kv-storage";

const key = (userId: string) => `my-gifts:${userId}`;

/** Purchase ids by item id. */
export async function readMyGifts(userId: string): Promise<Record<string, string>> {
  if (!userId) return {};
  try {
    const raw = await kvStorage.getItem(key(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const gifts: Record<string, string> = {};
    for (const [itemId, purchaseId] of Object.entries(parsed)) {
      if (typeof purchaseId === "string") gifts[itemId] = purchaseId;
    }
    return gifts;
  } catch {
    return {};
  }
}

/** Remembers a new gift on an item. A later gift on the same item replaces the earlier one, as the cookie does. */
export async function rememberGift(userId: string, itemId: string, purchaseId: string) {
  await rememberGifts(userId, { [itemId]: purchaseId });
}

/** Remembers new gifts, by item id. They go last, as the newest. */
export async function rememberGifts(userId: string, newGifts: Record<string, string>) {
  if (!userId || Object.keys(newGifts).length === 0) return;
  const gifts = await readMyGifts(userId);
  for (const [itemId, purchaseId] of Object.entries(newGifts)) {
    delete gifts[itemId];
    gifts[itemId] = purchaseId;
  }
  await kvStorage.setItem(key(userId), JSON.stringify(gifts));
}

/** Forgets the gift on an item, once it's released. */
export async function forgetGift(userId: string, itemId: string) {
  const gifts = await readMyGifts(userId);
  if (!(itemId in gifts)) return;
  delete gifts[itemId];
  await kvStorage.setItem(key(userId), JSON.stringify(gifts));
}
