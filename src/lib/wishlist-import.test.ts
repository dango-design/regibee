// Run with: node --test src/lib/wishlist-import.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isElfsterWishlistUrl,
  parseImportItem,
  planWishlistSync,
  takenForGuests,
  titleKey,
  type ImportItem,
} from "./wishlist-import.ts";

const USER = "11111111-2222-4333-8444-555555555555";
const LIST = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("only one wishlist's page on elfster.com counts", () => {
  assert.equal(isElfsterWishlistUrl(`https://www.elfster.com/profile/${USER}/wish-lists/${LIST}`), true);
  assert.equal(isElfsterWishlistUrl(`https://www.elfster.com/profile/${USER}/wish-lists/${LIST}/`), true);
  assert.equal(isElfsterWishlistUrl(`https://elfster.com/profile/${USER}/wish-lists/${LIST}?ref=share`), true);
  // The page that lists every wishlist, not one of them.
  assert.equal(isElfsterWishlistUrl(`https://www.elfster.com/profile/${USER}/wish-lists/`), false);
  assert.equal(isElfsterWishlistUrl("https://www.elfster.com/wish-lists"), false);
  assert.equal(isElfsterWishlistUrl(`https://elfster.com.example.com/profile/${USER}/wish-lists/${LIST}`), false);
  assert.equal(isElfsterWishlistUrl(`http://www.elfster.com/profile/${USER}/wish-lists/${LIST}`), false);
  assert.equal(isElfsterWishlistUrl(null), false);
  assert.equal(isElfsterWishlistUrl("not a link"), false);
});

test("items with no link match on their name", () => {
  assert.equal(titleKey("  Wool   Scarf "), "title:wool scarf");
  assert.equal(titleKey("WOOL SCARF"), titleKey("wool scarf"));
  assert.equal(titleKey("   "), null);
  assert.equal(titleKey(null), null);
});

test("a whole item comes through as it was read", () => {
  assert.deepEqual(
    parseImportItem({
      url: "https://shop.example.com/p/scarf?color=red",
      title: " Wool  Scarf ",
      price: 24.999,
      imageUrl: "https://cdn.example.com/scarf.png",
      quantity: 2,
      notes: "  The red one.  ",
      isEssential: true,
    }),
    {
      url: "https://shop.example.com/p/scarf?color=red",
      title: "Wool Scarf",
      price: 25,
      imageUrl: "https://cdn.example.com/scarf.png",
      quantity: 2,
      notes: "The red one.",
      isEssential: true,
      wishId: null,
      received: 0,
      given: 0,
    }
  );
});

test("an item needs a name, and nothing else", () => {
  assert.deepEqual(parseImportItem({ title: "Gift card" }), {
    url: null,
    title: "Gift card",
    price: null,
    imageUrl: null,
    quantity: 1,
    notes: null,
    isEssential: false,
    wishId: null,
    received: 0,
    given: 0,
  });
  assert.equal(parseImportItem({ title: "  ", url: "https://shop.example.com/p/1" }), null);
  assert.equal(parseImportItem({ url: "https://shop.example.com/p/1" }), null);
  assert.equal(parseImportItem(null), null);
  assert.equal(parseImportItem("Wool Scarf"), null);
});

test("a bad link, picture, price or quantity is dropped, and the item stays", () => {
  const item = parseImportItem({
    title: "Wool Scarf",
    url: "javascript:alert(1)",
    imageUrl: "http://cdn.example.com/scarf.png",
    price: -5,
    quantity: 1.5,
    notes: 7,
    isEssential: "yes",
  });
  assert.deepEqual(item, {
    url: null,
    title: "Wool Scarf",
    price: null,
    imageUrl: null,
    quantity: 1,
    notes: null,
    isEssential: false,
    wishId: null,
    received: 0,
    given: 0,
  });
  assert.equal(parseImportItem({ title: "A", url: `https://shop.example.com/${"x".repeat(2000)}` })?.url, null);
  assert.equal(parseImportItem({ title: "A", price: 100_001 })?.price, null);
  assert.equal(parseImportItem({ title: "A", quantity: 500 })?.quantity, 99);
  assert.equal(parseImportItem({ title: "A", quantity: 0 })?.quantity, 1);
  assert.equal(parseImportItem({ title: "A".repeat(400) })?.title.length, 300);
});

test("a wish's id and counts come through, and bad ones are dropped", () => {
  const item = parseImportItem({ title: "A", wishId: " w-1 ", received: 1, given: 2 });
  assert.equal(item?.wishId, "w-1");
  assert.equal(item?.received, 1);
  assert.equal(item?.given, 2);
  const bad = parseImportItem({ title: "A", wishId: "x".repeat(101), received: -1, given: 1.5 });
  assert.equal(bad?.wishId, null);
  assert.equal(bad?.received, 0);
  assert.equal(bad?.given, 0);
  assert.equal(parseImportItem({ title: "A", given: 500 })?.given, 99);
});

// The tests' own key: the link when there is one, else the name.
const keyOf = (item: { url: string | null; title: string | null }) => (item.url ? `url:${item.url}` : titleKey(item.title));

function wish(wishId: string, fields: Partial<ImportItem> = {}): ImportItem {
  return {
    url: null,
    title: wishId,
    price: null,
    imageUrl: null,
    quantity: 1,
    notes: null,
    isEssential: false,
    wishId,
    received: 0,
    given: 0,
    ...fields,
  };
}

test("a sync matches wishes to items by link, then by name", () => {
  const plan = planWishlistSync(
    [
      wish("w1", { url: "https://shop.example.com/p/1", title: "Scarf", given: 1 }),
      wish("w2", { title: "Board Game" }),
      wish("w3", { title: "Not on Regibee", given: 1 }),
    ],
    [
      { id: "i1", title: "Wool scarf", url: "https://shop.example.com/p/1" },
      { id: "i2", title: "board  game", url: null },
    ],
    [],
    keyOf,
  );
  assert.deepEqual(plan.matched, [
    { itemId: "i1", wishId: "w1", given: 1 },
    { itemId: "i2", wishId: "w2", given: 0 },
  ]);
  assert.deepEqual(plan.gone, []);
});

test("a wish keeps the item it matched before, even after a rename", () => {
  const plan = planWishlistSync(
    [wish("w1", { title: "New name", url: "https://shop.example.com/p/9" })],
    [{ id: "i1", title: "Old name", url: null }],
    [{ itemId: "i1", wishId: "w1" }],
    keyOf,
  );
  assert.deepEqual(plan.matched, [{ itemId: "i1", wishId: "w1", given: 0 }]);
});

test("two wishes for the same thing take two items, or one when there's only one", () => {
  const items = [
    { id: "i1", title: "Socks", url: null },
    { id: "i2", title: "Socks", url: null },
  ];
  const both = planWishlistSync([wish("w1", { title: "Socks" }), wish("w2", { title: "Socks" })], items, [], keyOf);
  assert.deepEqual(both.matched.map((m) => m.itemId), ["i1", "i2"]);
  const one = planWishlistSync([wish("w1", { title: "Socks" }), wish("w2", { title: "Socks" })], items.slice(0, 1), [], keyOf);
  assert.deepEqual(one.matched.map((m) => m.itemId), ["i1"]);
});

test("an item matched before is taken by no other wish", () => {
  const plan = planWishlistSync(
    [wish("w2", { title: "Socks" }), wish("w1", { title: "Something else" })],
    [{ id: "i1", title: "Socks", url: null }],
    [{ itemId: "i1", wishId: "w1" }],
    keyOf,
  );
  assert.deepEqual(plan.matched, [{ itemId: "i1", wishId: "w1", given: 0 }]);
});

test("received counts as given, whichever is higher", () => {
  const plan = planWishlistSync(
    [wish("w1", { received: 2, given: 1 }), wish("w2", { received: 0, given: 1 })],
    [
      { id: "i1", title: "w1", url: null },
      { id: "i2", title: "w2", url: null },
    ],
    [],
    keyOf,
  );
  assert.deepEqual(plan.matched.map((m) => m.given), [2, 1]);
});

test("an item whose wish left the wishlist is listed as gone", () => {
  const plan = planWishlistSync(
    [wish("w1")],
    [
      { id: "i1", title: "w1", url: null },
      { id: "i2", title: "Deleted on Elfster", url: null },
    ],
    [
      { itemId: "i1", wishId: "w1" },
      { itemId: "i2", wishId: "w2" },
      // An item that's no longer on the list isn't.
      { itemId: "i3", wishId: "w3" },
    ],
    keyOf,
  );
  assert.deepEqual(plan.gone, [{ id: "i2", title: "Deleted on Elfster", url: null }]);
});

test("a wish with no id is skipped", () => {
  const plan = planWishlistSync([wish("w1", { wishId: null })], [{ id: "i1", title: "w1", url: null }], [], keyOf);
  assert.deepEqual(plan.matched, []);
});

test("guests see what's been given on Elfster as taken, up to how many are wanted", () => {
  assert.equal(takenForGuests(3, 1, 1), 2);
  assert.equal(takenForGuests(2, 1, 5), 2);
  assert.equal(takenForGuests(2, 0, 0), 0);
  // More gifts than wanted already: the count stays as it is.
  assert.equal(takenForGuests(1, 2, 1), 2);
  assert.equal(takenForGuests(2, 1, -3), 1);
});
