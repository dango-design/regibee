// Run with: node --test src/lib/wishlist-import.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { isElfsterWishlistUrl, parseImportItem, titleKey } from "./wishlist-import.ts";

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
  });
  assert.equal(parseImportItem({ title: "A", url: `https://shop.example.com/${"x".repeat(2000)}` })?.url, null);
  assert.equal(parseImportItem({ title: "A", price: 100_001 })?.price, null);
  assert.equal(parseImportItem({ title: "A", quantity: 500 })?.quantity, 99);
  assert.equal(parseImportItem({ title: "A", quantity: 0 })?.quantity, 1);
  assert.equal(parseImportItem({ title: "A".repeat(400) })?.title.length, 300);
});
