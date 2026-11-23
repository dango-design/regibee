// Run with: node --test src/lib/support-search.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSupportSearch } from "./support-search.ts";

test("finds a list's slug in a pasted link", () => {
  assert.deepEqual(parseSupportSearch("https://www.regibee.com/r/remi-max-abcdefghjkmn?tab=gifts"), {
    kind: "list",
    slug: "remi-max-abcdefghjkmn",
  });
  assert.deepEqual(parseSupportSearch("/r/Remi-Max-ABCDEFGHJKMN"), { kind: "list", slug: "remi-max-abcdefghjkmn" });
});

test("finds a profile's id in a pasted link", () => {
  assert.deepEqual(parseSupportSearch("regibee.com/u/jane-doe-k7m2p9qx4t"), { kind: "profile", publicId: "k7m2p9qx4t" });
});

test("a profile link without a valid id is searched as text", () => {
  assert.deepEqual(parseSupportSearch("/u/jane"), { kind: "text", text: "/u/jane" });
});

test("anything else is text to match", () => {
  assert.deepEqual(parseSupportSearch("  jane@example.com "), { kind: "text", text: "jane@example.com" });
  assert.deepEqual(parseSupportSearch("Christmas"), { kind: "text", text: "Christmas" });
});

test("empty or one-letter searches find nothing", () => {
  assert.equal(parseSupportSearch(""), null);
  assert.equal(parseSupportSearch("   "), null);
  assert.equal(parseSupportSearch(undefined), null);
  assert.equal(parseSupportSearch("j"), null);
});
