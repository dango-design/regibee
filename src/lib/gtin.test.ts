// Run with: node --test src/lib/gtin.test.ts
//
// Checking and saving products' barcode numbers (src/lib/gtin.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import { gtinChange, gtinForLink, normalizeGtin } from "./gtin.ts";

// A bassinet's UPC, as Target and Walmart show it.
const UPC = "819956000350";
const SAVED = "00819956000350";

test("pads a UPC to 14 digits", () => {
  assert.equal(normalizeGtin(UPC), SAVED);
});

test("an EAN, a GTIN-14 and a UPC for the same product save the same", () => {
  assert.equal(normalizeGtin("0819956000350"), SAVED);
  assert.equal(normalizeGtin("00819956000350"), SAVED);
});

test("reads a GTIN given as a number, even one that lost its leading zero", () => {
  assert.equal(normalizeGtin(819956000350), SAVED);
  // UPC 012345678905 stored as a number.
  assert.equal(normalizeGtin(12345678905), "00012345678905");
});

test("reads an EAN-13 and an 8-digit GTIN", () => {
  assert.equal(normalizeGtin("4006381333931"), "04006381333931");
  assert.equal(normalizeGtin("96385074"), "00000096385074");
});

test("ignores spaces and dashes", () => {
  assert.equal(normalizeGtin(" 8 19956 00035 0 "), SAVED);
  assert.equal(normalizeGtin("819956-000350"), SAVED);
});

test("refuses a wrong check digit", () => {
  assert.equal(normalizeGtin("819956000351"), null);
});

test("refuses what isn't a GTIN", () => {
  for (const raw of ["", "1234567", "123456789012345", "81995600035a", "00000000000000", null, undefined, {}, 1.5, -819956000350]) {
    assert.equal(normalizeGtin(raw), null, String(raw));
  }
});

test("sends a barcode only with the link it was read from", () => {
  const read = { url: "https://www.target.com/p/-/A-77459747", gtin: SAVED };
  assert.equal(gtinForLink(read, "https://www.target.com/p/-/A-77459747"), SAVED);
  assert.equal(gtinForLink(read, " https://www.target.com/p/-/A-77459747 "), SAVED);
  assert.equal(gtinForLink(read, "https://www.walmart.com/ip/530466558"), "");
  assert.equal(gtinForLink(read, ""), "");
  assert.equal(gtinForLink(null, "https://www.target.com/p/-/A-77459747"), "");
  assert.equal(gtinForLink({ ...read, gtin: null }, read.url), "");
});

test("an edit with a barcode saves it", () => {
  assert.deepEqual(gtinChange(UPC, "https://a.example/1", "https://b.example/2"), { gtin: SAVED });
  assert.deepEqual(gtinChange(UPC, "https://a.example/1", "https://a.example/1"), { gtin: SAVED });
});

test("an edit without a barcode keeps the saved one when the link stays", () => {
  assert.deepEqual(gtinChange("", "https://a.example/1", "https://a.example/1"), {});
  assert.deepEqual(gtinChange(undefined, null, null), {});
  assert.deepEqual(gtinChange(null, null, undefined), {});
  // The same address written two ways, as the phone app sends it back.
  assert.deepEqual(gtinChange("", "https://shop.example", "https://shop.example/"), {});
  assert.deepEqual(gtinChange("", "https://Shop.Example/crème", "https://shop.example/cr%C3%A8me"), {});
});

test("an edit without a barcode clears the saved one when the link changes", () => {
  assert.deepEqual(gtinChange("", "https://a.example/1", "https://b.example/2"), { gtin: null });
  assert.deepEqual(gtinChange(undefined, "https://a.example/1", null), { gtin: null });
  // A barcode that doesn't check out counts as none.
  assert.deepEqual(gtinChange("819956000351", "https://a.example/1", "https://b.example/2"), { gtin: null });
});
