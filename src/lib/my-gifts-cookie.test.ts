import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_APP_GIFTS,
  MY_GIFTS_COOKIE,
  hasAccountGifts,
  newGifts,
  parseAppGifts,
  parseMyGiftsCookie,
  purchaseIdsToCheck,
  syncAppGifts,
  webViewGifts,
  withFundGift,
  withGift,
} from "./my-gifts-cookie.ts";

/** A uuid made from a number, so tests can name ids. */
const id = (n: number, prefix = "a") => `${prefix.repeat(8)}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = (n: number) => id(n, "1");
const gift = (n: number) => id(n, "2");
const ACCOUNT = id(1, "3");
const OTHER = id(2, "3");

test("withGift adds a gift and keeps the newest last", () => {
  let raw = withGift(undefined, "items", item(1), gift(1));
  raw = withGift(raw, "items", item(2), gift(2));
  raw = withGift(raw, "items", item(1), gift(3));
  assert.deepEqual(Object.entries(parseMyGiftsCookie(raw).items ?? {}), [
    [item(2), gift(2)],
    [item(1), gift(3)],
  ]);
});

test("withGift drops the oldest gifts before the cookie gets too big to keep", () => {
  let raw: string | undefined;
  for (let n = 1; n <= 80; n++) raw = withGift(raw, "items", item(n), gift(n));
  const items = parseMyGiftsCookie(raw).items ?? {};
  assert.ok(MY_GIFTS_COOKIE.length + 1 + encodeURIComponent(raw!).length <= 4096);
  assert.equal(items[item(80)], gift(80));
  assert.equal(items[item(1)], undefined);
  assert.ok(Object.keys(items).length > 30);
});

test("parseAppGifts reads the header, or null when there's none", () => {
  assert.equal(parseAppGifts(null), null);
  assert.deepEqual(parseAppGifts("not json"), {});
  assert.deepEqual(parseAppGifts("[]"), {});
  assert.deepEqual(parseAppGifts(JSON.stringify({ [item(1)]: gift(1), "not-an-id": gift(2), [item(3)]: "reserved" })), {
    [item(1)]: gift(1),
  });
});

test("parseAppGifts keeps only the newest gifts", () => {
  const sent = Object.fromEntries(Array.from({ length: MAX_APP_GIFTS + 10 }, (_, n) => [item(n), gift(n)]));
  const read = parseAppGifts(JSON.stringify(sent))!;
  assert.equal(Object.keys(read).length, MAX_APP_GIFTS);
  assert.equal(read[item(MAX_APP_GIFTS + 9)], gift(MAX_APP_GIFTS + 9));
  assert.equal(read[item(0)], undefined);
});

test("syncAppGifts adds the app's live gifts and marks the cookie with the account", () => {
  const raw = withGift(undefined, "items", item(1), gift(1));
  const live = new Map([
    [gift(1), item(1)],
    [gift(2), item(2)],
  ]);
  const synced = parseMyGiftsCookie(
    syncAppGifts({ raw, fromApp: { [item(2)]: gift(2), [item(3)]: gift(3) }, account: ACCOUNT, live })
  );
  assert.deepEqual(synced.items, { [item(1)]: gift(1), [item(2)]: gift(2) });
  assert.equal(synced.account, ACCOUNT);
});

test("syncAppGifts only counts a purchase id on its own item", () => {
  // gift(2) is live, but on item 2: it proves nothing about item 9.
  const live = new Map([[gift(2), item(2)]]);
  const synced = parseMyGiftsCookie(syncAppGifts({ raw: undefined, fromApp: { [item(9)]: gift(2) }, account: ACCOUNT, live }));
  assert.deepEqual(synced.items, {});
});

test("syncAppGifts drops gifts that were released and lets the app's win on the same item", () => {
  let raw = withGift(undefined, "items", item(1), gift(1));
  raw = withGift(raw, "items", item(2), gift(2));
  const live = new Map([
    [gift(2), item(2)],
    [gift(5), item(2)],
  ]);
  const synced = parseMyGiftsCookie(syncAppGifts({ raw, fromApp: { [item(2)]: gift(5) }, account: ACCOUNT, live }));
  assert.deepEqual(synced.items, { [item(2)]: gift(5) });
});

test("syncAppGifts keeps fund amounts for the same account and drops another account's gifts", () => {
  let raw = withGift(undefined, "items", item(1), gift(1));
  raw = withGift(raw, "funds", item(7), 25);
  const live = new Map([
    [gift(1), item(1)],
    [gift(2), item(2)],
  ]);
  const mine = parseMyGiftsCookie(syncAppGifts({ raw, fromApp: {}, account: ACCOUNT, live }));
  assert.deepEqual(mine.items, { [item(1)]: gift(1) });
  assert.deepEqual(mine.funds, { [item(7)]: 25 });

  const theirs = syncAppGifts({ raw, fromApp: {}, account: ACCOUNT, live });
  const switched = parseMyGiftsCookie(syncAppGifts({ raw: theirs, fromApp: { [item(2)]: gift(2) }, account: OTHER, live }));
  assert.deepEqual(switched.items, { [item(2)]: gift(2) });
  assert.equal(switched.funds, undefined);
  assert.equal(switched.account, OTHER);
});

test("purchaseIdsToCheck leaves out another account's gifts", () => {
  const raw = syncAppGifts({
    raw: undefined,
    fromApp: { [item(1)]: gift(1) },
    account: ACCOUNT,
    live: new Map([[gift(1), item(1)]]),
  });
  assert.deepEqual(purchaseIdsToCheck(raw, { [item(2)]: gift(2) }, ACCOUNT).sort(), [gift(1), gift(2)].sort());
  assert.deepEqual(purchaseIdsToCheck(raw, { [item(2)]: gift(2) }, OTHER), [gift(2)]);
});

test("hasAccountGifts is true only for a cookie the app marked", () => {
  assert.equal(hasAccountGifts(withGift(undefined, "items", item(1), gift(1))), false);
  assert.equal(hasAccountGifts(syncAppGifts({ raw: undefined, fromApp: {}, account: ACCOUNT, live: new Map() })), true);
  assert.equal(hasAccountGifts(undefined), false);
});

test("webViewGifts reads the encoded cookie only for its own account", () => {
  const raw = syncAppGifts({
    raw: undefined,
    fromApp: { [item(1)]: gift(1) },
    account: ACCOUNT,
    live: new Map([[gift(1), item(1)]]),
  });
  const encoded = encodeURIComponent(raw);
  assert.deepEqual(webViewGifts(encoded, ACCOUNT), { [item(1)]: gift(1) });
  assert.equal(webViewGifts(encoded, OTHER), null);
  assert.equal(webViewGifts(encodeURIComponent(withGift(undefined, "items", item(1), gift(1))), ACCOUNT), null);
  assert.equal(webViewGifts("%E0%A4%A", ACCOUNT), null);
  assert.equal(webViewGifts(encoded, ""), null);
});

test("newGifts lists only gifts that are new or changed", () => {
  assert.deepEqual(newGifts({ [item(1)]: gift(1) }, { [item(1)]: gift(1), [item(2)]: gift(2) }), { [item(2)]: gift(2) });
  assert.deepEqual(newGifts({ [item(1)]: gift(1) }, { [item(1)]: gift(3) }), { [item(1)]: gift(3) });
  assert.deepEqual(newGifts({ [item(1)]: gift(1) }, {}), {});
});

test("withFundGift adds a second gift to the same fund to the first", () => {
  let raw = withFundGift(undefined, item(1), 25);
  raw = withFundGift(raw, item(1), 10.5);
  raw = withFundGift(raw, item(2), 5);
  assert.deepEqual(parseMyGiftsCookie(raw).funds, { [item(1)]: 35.5, [item(2)]: 5 });
});
