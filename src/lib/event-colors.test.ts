// Run with: node --test src/lib/event-colors.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { THEME_COLOR_PRESETS, contrast, normalizeThemeColor, themeColors } from "./event-colors.ts";

// The site's text colors (src/styles/theme.css): primary, secondary, tertiary.
const TEXT = ["#231b18", "#4d4440", "#5e5652"];

const SAMPLES = [
  "#000000",
  "#ffffff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#1b2a4a",
  "#7a1f2b",
  "#f8d7da",
  "#888888",
  ...THEME_COLOR_PRESETS.map((p) => p.color),
];

test("only six-digit hex colors are kept, in lowercase", () => {
  assert.equal(normalizeThemeColor(" #A1B2C3 "), "#a1b2c3");
  assert.equal(normalizeThemeColor("#abc"), null);
  assert.equal(normalizeThemeColor("red"), null);
  assert.equal(normalizeThemeColor("#a1b2c3; background: url(x)"), null);
  assert.equal(normalizeThemeColor(null), null);
  assert.equal(normalizeThemeColor(""), null);
});

test("every text color reads on the fill, whatever the host picks", () => {
  for (const color of SAMPLES) {
    const { fill } = themeColors(color);
    for (const text of TEXT) {
      assert.ok(contrast(text, fill) >= 4.5, `${text} on ${fill} (from ${color}) is ${contrast(text, fill).toFixed(2)}`);
    }
  }
});

test("the ink reads on the fill and on white", () => {
  for (const color of SAMPLES) {
    const { fill, ink } = themeColors(color);
    assert.ok(contrast(ink, fill) >= 4.5, `${ink} on ${fill} (from ${color})`);
    assert.ok(contrast(ink, "#ffffff") >= 4.5, `${ink} on white (from ${color})`);
  }
});

test("a light color is used as it is", () => {
  assert.equal(themeColors("#f8d7da").fill, "#f8d7da");
  assert.equal(themeColors("#a0e4d4").fill, "#a0e4d4");
});

test("a dark color becomes a light fill of the same hue", () => {
  const { fill } = themeColors("#1b2a4a");
  assert.notEqual(fill, "#1b2a4a");
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
  assert.ok(b > r && b > g, `${fill} should still be blue`);
});
