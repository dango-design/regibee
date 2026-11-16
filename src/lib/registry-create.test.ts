// Run with: node --test src/lib/registry-create.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRegistrySlug } from "./registry-create.ts";

// The same shape new_registry_slug makes in the database
// (supabase/migrations/20261114100553_list_links.sql).
const CODE = /^[a-kmnp-z2-9]{12}$/;

function split(slug: string) {
  const at = slug.lastIndexOf("-");
  return { title: slug.slice(0, at), code: slug.slice(at + 1) };
}

test("a link is the title in lowercase, then 12 random characters", () => {
  const { title, code } = split(generateRegistrySlug("Maya's Birthday Wishlist!"));
  assert.equal(title, "maya-s-birthday-wishlist");
  assert.match(code, CODE);
});

test("a title with no letters or numbers becomes 'list'", () => {
  assert.equal(split(generateRegistrySlug("🎁 🎄")).title, "list");
  assert.equal(split(generateRegistrySlug("")).title, "list");
});

test("a long title is cut to 50 characters, with no hyphen left at the end", () => {
  const { title } = split(generateRegistrySlug(`${"a".repeat(49)} and more`));
  assert.equal(title, "a".repeat(49));
});

test("two links for the same title differ", () => {
  const seen = new Set(Array.from({ length: 200 }, () => generateRegistrySlug("Wishlist")));
  assert.equal(seen.size, 200);
});
