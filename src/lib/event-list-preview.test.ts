// Run with: node --test src/lib/event-list-preview.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { listPreview, type PreviewItem } from "./event-list-preview.ts";

function item(id: string, overrides: Partial<PreviewItem> = {}): PreviewItem {
  return {
    id,
    title: `Item ${id}`,
    image_url: `https://example.com/${id}.jpg`,
    price: 10,
    quantity_needed: 1,
    quantity_fulfilled: 0,
    is_essential: false,
    is_parent_purchased: false,
    ...overrides,
  };
}

test("counts the items that still need a giver", () => {
  const preview = listPreview([item("a"), item("b", { quantity_fulfilled: 1 }), item("c")], 4);
  assert.equal(preview.itemsLeft, 2);
  assert.deepEqual(
    preview.items.map((i) => i.id),
    ["a", "c"],
  );
});

test("puts most wanted first, then items with a picture, up to the limit", () => {
  const preview = listPreview(
    [item("a", { image_url: null }), item("b"), item("c", { is_essential: true }), item("d")],
    2,
  );
  assert.equal(preview.itemsLeft, 4);
  assert.deepEqual(
    preview.items.map((i) => i.id),
    ["c", "b"],
  );
});

test("what's been given on Elfster counts as taken", () => {
  const given = new Map([
    ["a", 1],
    ["b", 1],
  ]);
  const preview = listPreview([item("a"), item("b", { quantity_needed: 3 }), item("c")], 4, given);
  // One of b's three was given there, so two are still needed.
  assert.equal(preview.itemsLeft, 2);
  assert.deepEqual(
    preview.items.map((i) => i.id),
    ["b", "c"],
  );
});

test("without Elfster's counts, as for a list's managers, nothing from Elfster counts", () => {
  const preview = listPreview([item("a"), item("b")], 4);
  assert.equal(preview.itemsLeft, 2);
});

test("an item the owners bought is left as it is", () => {
  const given = new Map([["a", 1]]);
  const preview = listPreview(
    [item("a", { is_parent_purchased: true }), item("b", { is_parent_purchased: true, quantity_fulfilled: 1 })],
    4,
    given,
  );
  // a still shows as its own fields say. b is bought and covered, so it's not open.
  assert.equal(preview.itemsLeft, 1);
  assert.deepEqual(
    preview.items.map((i) => i.id),
    ["a"],
  );
});

test("only sends what the preview shows", () => {
  const [shown] = listPreview([item("a")], 4).items;
  assert.deepEqual(Object.keys(shown).sort(), ["id", "image_url", "price", "title"]);
});

test("items hidden from their owner show as nothing reserved", () => {
  const preview = listPreview(
    [item("a", { quantity_fulfilled: 1 }), item("b", { quantity_needed: 3, quantity_fulfilled: 3 }), item("c", { quantity_fulfilled: 1 })],
    4,
    new Map(),
    new Set(["a", "b"]),
  );
  // c isn't hidden, so it still counts as taken.
  assert.equal(preview.itemsLeft, 2);
  assert.deepEqual(
    preview.items.map((i) => i.id),
    ["a", "b"],
  );
});

test("an item its owner bought themselves stays bought when gifts are hidden", () => {
  const preview = listPreview(
    [item("a", { quantity_fulfilled: 1, is_parent_purchased: true }), item("b")],
    4,
    new Map(),
    new Set(["a", "b"]),
  );
  assert.equal(preview.itemsLeft, 1);
});

test("a hidden item ignores what's been given on Elfster", () => {
  const preview = listPreview([item("a")], 4, new Map([["a", 1]]), new Set(["a"]));
  assert.equal(preview.itemsLeft, 1);
});
