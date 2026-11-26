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
// The website's pages in the web view (src/app/web.tsx) share the item gifts
// both ways: the web view hands them to the website when it opens, and the
// gifts given on a page there come back here. The rules are in the website's
// src/lib/my-gifts-cookie.ts. Fund amounts don't cross yet.

import { kvStorage } from "@/lib/kv-storage";

const key = (userId: string) => `my-gifts:${userId}`;
// Funds have their own key, so the item ids saved before funds were kept here still read the same.
const fundsKey = (userId: string) => `my-fund-gifts:${userId}`;

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

/** Amounts given by gift fund id. */
export async function readMyFundGifts(userId: string): Promise<Record<string, number>> {
  if (!userId) return {};
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

/** Remembers a contribution. A later one to the same fund replaces the earlier amount, as the cookie does. */
export async function rememberFundGift(userId: string, fundId: string, amount: number) {
  const funds = await readMyFundGifts(userId);
  funds[fundId] = amount;
  await kvStorage.setItem(fundsKey(userId), JSON.stringify(funds));
}
