// Run with: node --test src/lib/item-categories.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryName, categoryNamed, guessCategory, MAX_CATEGORY_NAME_LENGTH } from "./item-categories.ts";

test("a new category's name has its spaces tidied", () => {
  assert.equal(categoryName("  Bath   time \n"), "Bath time");
  assert.equal(categoryName("Kitchen"), "Kitchen");
});

test("a blank name or anything but text isn't a name", () => {
  assert.equal(categoryName(""), null);
  assert.equal(categoryName("   "), null);
  assert.equal(categoryName(undefined), null);
  assert.equal(categoryName(42), null);
});

test("a long name is cut to the longest a category takes", () => {
  const name = categoryName("a".repeat(MAX_CATEGORY_NAME_LENGTH + 20));
  assert.equal(name?.length, MAX_CATEGORY_NAME_LENGTH);
});

test("a list's category is found by its name, whatever its capitals and spaces", () => {
  const categories = [
    { id: "1", name: "Feeding" },
    { id: "2", name: "Gear & Travel" },
  ];
  assert.equal(categoryNamed(categories, "feeding")?.id, "1");
  assert.equal(categoryNamed(categories, " gear  &  travel ")?.id, "2");
  assert.equal(categoryNamed(categories, "Bath"), undefined);
  assert.equal(categoryNamed(categories, "  "), undefined);
});

test("a category is still guessed from words in the item's name", () => {
  const categories = [
    { id: "1", name: "Feeding" },
    { id: "2", name: "Bath" },
  ];
  assert.equal(guessCategory("Hooded bath towel", categories), "2");
  assert.equal(guessCategory("Glass baby bottle", categories), "1");
  assert.equal(guessCategory("Wool scarf", categories), undefined);
});
