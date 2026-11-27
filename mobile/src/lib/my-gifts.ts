// The gifts this account gave from the app's list screen, kept on the phone.
// The website keeps the same two things in its `regibee_my_gifts` cookie:
//
// - Purchase ids by item id, for items reserved, bought or covered. A
//   purchase id is the guest's proof that a gift is theirs: with it they can
//   say they bought it or release it, and see the shipping address. The list
//   loader only counts an id that matches a live gift on that item, so an old
//   one does no harm.
// - Amounts by gift fund id, for contributions. These only make the fund say
//   "Contributed" and show what was given.
//
// Kept per account, so someone else signing in on the same phone doesn't see
// them. Signing out leaves them, like the website's cookie.
//
// Gifts given while signed out are kept under the phone's own keys, which an
// empty `userId` reads and writes. When someone signs in, those move to their
// account (moveSignedOutGifts), so they can still say they bought them or
// release them. That's what the website does too: its cookie belongs to the
// browser, not the account.
//
// The website's pages in the web view (src/app/web.tsx) share the item gifts
// both ways: the web view hands them to the website when it opens, and the
// gifts given on a page there come back here. The rules are in the website's
// src/lib/my-gifts-cookie.ts. Fund amounts don't cross yet.

import { kvStorage } from "@/lib/kv-storage";

const SIGNED_OUT = "my-gifts:signed-out";
const SIGNED_OUT_FUNDS = "my-fund-gifts:signed-out";
// Funds have their own key, so the item ids saved before funds were kept here still read the same.
const fundsKey = (userId: string) => (userId ? `my-fund-gifts:${userId}` : SIGNED_OUT_FUNDS);

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
  await rememberGifts(userId, { [itemId]: purchaseId });
}

/** Remembers new gifts, by item id. They go last, as the newest. */
export async function rememberGifts(userId: string, newGifts: Record<string, string>) {
  if (Object.keys(newGifts).length === 0) return;
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

/** Amounts given by gift fund id. An empty `userId` reads the signed-out ones. */
export async function readMyFundGifts(userId: string): Promise<Record<string, number>> {
  try {
    const raw = await kvStorage.getItem(fundsKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const funds: Record<string, number> = {};
    for (const [fundId, amount] of Object.entries(parsed)) {
      if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) funds[fundId] = amount;
    }
    return funds;
  } catch {
    return {};
  }
}

/** Remembers a contribution. A later one to the same fund adds to the earlier amount, as the cookie does. */
export async function rememberFundGift(userId: string, fundId: string, amount: number) {
  const funds = await readMyFundGifts(userId);
  funds[fundId] = (funds[fundId] ?? 0) + amount;
  await kvStorage.setItem(fundsKey(userId), JSON.stringify(funds));
}

/**
 * Moves the gifts given while signed out to this account. Called when someone
 * signs in. A gift the account already has on the same item or fund stays.
 */
export async function moveSignedOutGifts(userId: string) {
  if (!userId) return;
  const [items, funds] = await Promise.all([readMyGifts(""), readMyFundGifts("")]);
  if (Object.keys(items).length > 0) {
    const gifts = { ...items, ...(await readMyGifts(userId)) };
    await kvStorage.setItem(key(userId), JSON.stringify(gifts));
    await kvStorage.removeItem(SIGNED_OUT);
  }
  if (Object.keys(funds).length > 0) {
    const amounts = { ...funds, ...(await readMyFundGifts(userId)) };
    await kvStorage.setItem(fundsKey(userId), JSON.stringify(amounts));
    await kvStorage.removeItem(SIGNED_OUT_FUNDS);
  }
}
