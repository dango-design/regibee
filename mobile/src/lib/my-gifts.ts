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
// Gifts reserved while signed out are kept under the phone's own key, which
// an empty `userId` reads and writes. When someone signs in, those move to
// their account (moveSignedOutGifts), so they can still say they bought them
// or release them. That's what the website does too: its cookie belongs to
// the browser, not the account.

import { kvStorage } from "@/lib/kv-storage";

const SIGNED_OUT = "my-gifts:signed-out";

const key = (userId: string) => (userId ? `my-gifts:${userId}` : SIGNED_OUT);

/** Purchase ids by item id. An empty `userId` reads the signed-out gifts. */
export async function readMyGifts(userId: string): Promise<Record<string, string>> {
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
  const gifts = await readMyGifts(userId);
  gifts[itemId] = purchaseId;
  await kvStorage.setItem(key(userId), JSON.stringify(gifts));
}

/** Forgets the gift on an item, once it's released. */
export async function forgetGift(userId: string, itemId: string) {
  const gifts = await readMyGifts(userId);
  if (!(itemId in gifts)) return;
  delete gifts[itemId];
  await kvStorage.setItem(key(userId), JSON.stringify(gifts));
}

/**
 * Moves the gifts reserved while signed out to this account. Called when
 * someone signs in. A gift the account already has on the same item stays.
 */
export async function moveSignedOutGifts(userId: string) {
  if (!userId) return;
  const signedOut = await readMyGifts("");
  if (Object.keys(signedOut).length === 0) return;
  const gifts = { ...signedOut, ...(await readMyGifts(userId)) };
  await kvStorage.setItem(key(userId), JSON.stringify(gifts));
  await kvStorage.removeItem(SIGNED_OUT);
}
