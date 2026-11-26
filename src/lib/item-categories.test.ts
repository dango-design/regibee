// Run with: node --test src/lib/item-categories.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoryName,
  categoryNamed,
  guessCategory,
  MAX_CATEGORY_NAME_LENGTH,
  sortPlan,
  storeCategoryPath,
  suggestCategory,
} from "./item-categories.ts";

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

const BABY = [
  "Nursery & Sleep", "Feeding", "Diapering", "Gear & Travel", "Bath", "Clothing",
  "Health & Safety", "Toys & Books", "Maternity & Postpartum", "Gifts & Extras",
].map((name, i) => ({ id: String(i), name }));

test("an item with no fitting category on the list gets a broad one to add", () => {
  const list = [{ id: "c", name: "Clothing" }];
  const cases: [string, string][] = [
    ["Laneige Lip Sleeping Mask, Berry", "Beauty"],
    ["Lindt LINDOR Assorted Milk, Dark and White Chocolate Truffles", "Food & Drink"],
    ["Catan Board Game (Base Game) | Family Board Game", "Games"],
    ["The Legend of Zelda: Tears of the Kingdom - Nintendo Switch", "Games"],
    ["LEGO Icons Bouquet of Roses Building Set for Adults, Artificial Flowers Home Décor", "Toys"],
    ["Apple AirPods Pro 2 Wireless Earbuds, Active Noise Cancellation", "Electronics"],
    ["Kindle Paperwhite (16 GB)", "Electronics"],
    ["Fourth Wing (The Empyrean, 1) Hardcover", "Books"],
    ["Le Creuset Enameled Cast Iron Signature Round Dutch Oven, 5.5 qt.", "Home & Kitchen"],
    ["Nespresso Vertuo Coffee and Espresso Machine by Breville", "Home & Kitchen"],
    ["Death Wish Coffee Co. Whole Bean Coffee", "Food & Drink"],
    ["Kong Classic Dog Toy", "Pets"],
    ["Yoga Mat Non Slip, Pilates Fitness Mats", "Sports & Fitness"],
    ["Pandora Moments Snake Chain Bracelet", "Jewelry & Accessories"],
    ["Fender Player Stratocaster Electric Guitar", "Music"],
    ["Samsonite Freeform Hardside Expandable Spinner Carry-On", "Travel"],
    ["Moleskine Classic Notebook, Hard Cover", "Office & Stationery"],
    ["Crayola Ultimate Crayon Collection, 152 Count", "Arts & Crafts"],
  ];
  for (const [title, name] of cases) assert.deepEqual(suggestCategory(title, list), { name }, title);
});

test("an item goes in the list's own category when one fits", () => {
  const list = [{ id: "c", name: "Clothing" }];
  assert.deepEqual(suggestCategory("Hanes Men's EcoSmart Fleece Sweatshirt", list), { id: "c", name: "Clothing" });
  assert.deepEqual(suggestCategory("Cat & Jack Girls' Long Sleeve Graphic T-Shirt", list), { id: "c", name: "Clothing" });
  // A category named another way still counts.
  assert.equal(suggestCategory("Carhartt Knit Cuffed Beanie", [{ id: "x", name: "Clothes & Shoes" }])?.id, "x");
  assert.equal(suggestCategory("Board game night bundle", [{ id: "g", name: "games and puzzles" }])?.id, "g");
});

test("an owner's own category name counts as a word", () => {
  assert.equal(suggestCategory("Soy candle, vanilla", [{ id: "x", name: "Candles" }])?.id, "x");
  // Filler words in a name match nothing.
  assert.equal(suggestCategory("Other things", [{ id: "x", name: "Other stuff" }]), undefined);
});

test("a baby list uses its starting categories before adding new ones", () => {
  assert.equal(suggestCategory("Catan Board Game", BABY)?.name, "Toys & Books");
  assert.equal(suggestCategory("Hooded bath towel", BABY)?.name, "Bath");
  assert.equal(suggestCategory("Baby monitor with camera", BABY)?.name, "Nursery & Sleep");
  assert.deepEqual(suggestCategory("Ninja air fryer", BABY), { name: "Home & Kitchen" });
});

test("words match whole words only, and a longer phrase wins", () => {
  assert.equal(suggestCategory("What's that thing", []), undefined);
  assert.equal(suggestCategory("Apple Watch Series 10", [])?.name, "Electronics");
  assert.equal(suggestCategory("Rose gold necklace", [])?.name, "Jewelry & Accessories");
});

test("the store's category decides when the name doesn't", () => {
  assert.equal(suggestCategory("Essentials Slim-Fit Short-Sleeve", []), undefined);
  assert.deepEqual(
    suggestCategory({ title: "Essentials Slim-Fit Short-Sleeve", storeCategory: ["Clothing, Shoes & Jewelry", "Men", "Clothing", "Shirts"] }, []),
    { name: "Clothing" },
  );
  assert.deepEqual(
    suggestCategory({ title: "Wingspan", storeCategory: ["Toys & Games", "Games & Accessories", "Board Games"] }, []),
    { name: "Games" },
  );
});

test("the store's breadcrumbs are cleaned", () => {
  assert.deepEqual(storeCategoryPath(["Home", "Kitchen", "  Cookware ", "Cookware", "Lodge 10 inch cast iron skillet"], "Lodge 10 inch cast iron skillet"), [
    "Kitchen",
    "Cookware",
  ]);
  assert.deepEqual(storeCategoryPath([null, 3, "x".repeat(61)]), []);
});

test("sorting adds each new category once and leaves out what fits nowhere", () => {
  const plan = sortPlan(
    [
      { id: "1", title: "Chocolate truffles" },
      { id: "2", title: "Hot sauce gift set" },
      { id: "3", title: "Linen shirt" },
      { id: "4", title: "Something vague" },
    ],
    [{ id: "c", name: "Clothing" }],
  );
  assert.deepEqual(plan.newNames, ["Food & Drink"]);
  assert.deepEqual(plan.assignments, [
    { itemId: "1", categoryId: "new:Food & Drink" },
    { itemId: "2", categoryId: "new:Food & Drink" },
    { itemId: "3", categoryId: "c" },
  ]);
});
