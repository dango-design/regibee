import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HEADER_COLORS,
  HEADER_PATTERNS,
  headerChoice,
  headerOccasion,
  listHeader,
  parseHeaderChoice,
  patternTile,
  patternsFor,
} from "./list-headers.ts";

test("a list with nothing saved gets the light teal with dots", () => {
  assert.equal(headerChoice({}), null);
  assert.equal(headerChoice(null), null);
  const header = listHeader(headerChoice({ payment_methods: {} }));
  assert.equal(header.color.id, "sky");
  assert.equal(header.pattern.id, "dots");
});

test("a saved choice is read back", () => {
  const settings = { header: { color: "blush", pattern: "feet" } };
  assert.deepEqual(headerChoice(settings), { color: "blush", pattern: "feet" });
  const header = listHeader(headerChoice(settings));
  assert.equal(header.color.id, "blush");
  assert.equal(header.pattern.id, "feet");
});

test("an unknown color or pattern falls back for that half only", () => {
  const header = listHeader({ color: "neon", pattern: "hearts" });
  assert.equal(header.color.id, "sky");
  assert.equal(header.pattern.id, "hearts");
  assert.equal(listHeader({ color: "mint", pattern: 4 as unknown as string }).pattern.id, "dots");
});

test("only known colors and patterns can be saved", () => {
  assert.deepEqual(parseHeaderChoice({ color: "mint", pattern: "dreams", extra: 1 }), { color: "mint", pattern: "dreams" });
  assert.equal(parseHeaderChoice({ color: "mint" }), null);
  assert.equal(parseHeaderChoice({ color: "mint", pattern: "<script>" }), null);
  assert.equal(parseHeaderChoice("mint"), null);
  assert.equal(parseHeaderChoice(null), null);
});

test("patterns that suit the list come first, and none go missing", () => {
  const baby = patternsFor(headerOccasion("baby", null));
  assert.deepEqual(
    baby.slice(0, 5).map((p) => p.id),
    ["feet", "animals", "dreams", "baby", "hearts"],
  );
  assert.equal(baby.length, HEADER_PATTERNS.length);
  assert.equal(new Set(baby.map((p) => p.id)).size, HEADER_PATTERNS.length);
  assert.equal(patternsFor(headerOccasion("personal", "birthday"))[0].id, "balloons");
  assert.equal(patternsFor(headerOccasion("personal", "other")), HEADER_PATTERNS);
});

test("every pattern but Plain draws a tile in the color it's given", () => {
  for (const pattern of HEADER_PATTERNS) {
    const tile = patternTile(pattern.id, "#123456");
    if (pattern.id === "plain") {
      assert.equal(tile, null);
      continue;
    }
    assert.ok(tile, pattern.id);
    assert.ok(tile.size > 0);
    assert.ok(tile.body.includes("#123456"), pattern.id);
  }
});

test("colors and patterns have unique ids and every color has hex tones", () => {
  assert.equal(new Set(HEADER_COLORS.map((c) => c.id)).size, HEADER_COLORS.length);
  assert.equal(new Set(HEADER_PATTERNS.map((p) => p.id)).size, HEADER_PATTERNS.length);
  for (const color of HEADER_COLORS) {
    for (const tones of [color.light, color.dark]) {
      for (const value of Object.values(tones)) assert.match(value, /^#[0-9a-f]{6}$/);
    }
  }
});
