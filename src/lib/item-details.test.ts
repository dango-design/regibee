// Run with: node --test src/lib/item-details.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detailChanges,
  detailReviewHeading,
  isMissingDetails,
  parseDetailChanges,
  PRICE_CHECK_DAYS,
  priceChanges,
  priceCheckDue,
  priceChecksOff,
  priceCheckSetting,
  shownSide,
  turnedDownBefore,
  type DetailChange,
  type ItemDetails,
  type LastRead,
  type PriceCheckItem,
  type ReadDetails,
} from "./item-details.ts";

// An item added from an iPad when Amazon blocked the server: a name guessed
// from the link, no photo, no price.
const guessed: ItemDetails = {
  title: "Hatch Rest Sound Machine",
  price: null,
  image_url: null,
  is_parent_purchased: false,
};

const read: ReadDetails = {
  title: "Hatch Rest Baby Sound Machine, Night Light & Time-to-Rise",
  price: 59.99,
  images: ["https://m.media-amazon.com/images/I/rest-1.jpg", "https://m.media-amazon.com/images/I/rest-2.jpg"],
};

test("an item with no photo, or no price, is missing details", () => {
  assert.equal(isMissingDetails(guessed), true);
  assert.equal(isMissingDetails({ ...guessed, image_url: "https://example.com/a.jpg" }), true);
  assert.equal(isMissingDetails({ ...guessed, price: 12 }), true);
  assert.equal(isMissingDetails({ ...guessed, price: 12, image_url: "https://example.com/a.jpg" }), false);
});

test("a bought item with a photo isn't missing details without a price", () => {
  const bought = { ...guessed, image_url: "https://example.com/a.jpg", is_parent_purchased: true };
  assert.equal(isMissingDetails(bought), false);
});

test("a read replaces the name, and fills in the empty price and photo", () => {
  assert.deepEqual(detailChanges(guessed, read), [
    { field: "title", before: "Hatch Rest Sound Machine", after: read.title },
    { field: "price", before: null, after: 59.99 },
    { field: "image_url", before: null, after: read.images[0] },
  ]);
});

test("the same name with other capitals or spaces isn't a change", () => {
  const item = { ...guessed, title: "  hatch rest baby sound machine,  night light & time-to-rise " };
  assert.deepEqual(
    detailChanges(item, read).map((c) => c.field),
    ["price", "image_url"],
  );
});

test("a price the store has differently replaces the old one", () => {
  const item = { ...guessed, title: read.title, price: 49.99 };
  assert.deepEqual(detailChanges(item, read), [
    { field: "price", before: 49.99, after: 59.99 },
    { field: "image_url", before: null, after: read.images[0] },
  ]);
});

test("the same price isn't a change", () => {
  const item = { ...guessed, title: read.title, price: 59.990000001 };
  assert.deepEqual(
    detailChanges(item, read).map((c) => c.field),
    ["image_url"],
  );
});

test("a bought item keeps the price the owner paid, even an empty one", () => {
  assert.deepEqual(
    detailChanges({ ...guessed, title: read.title, price: 45, is_parent_purchased: true }, read).map((c) => c.field),
    ["image_url"],
  );
  assert.deepEqual(
    detailChanges({ ...guessed, title: read.title, is_parent_purchased: true }, read).map((c) => c.field),
    ["image_url"],
  );
});

test("a photo already there stays", () => {
  const item = { ...guessed, title: read.title, price: 59.99, image_url: "https://example.com/uploaded.jpg" };
  assert.deepEqual(detailChanges(item, read), []);
});

test("a read without a price or photo changes only the name", () => {
  assert.deepEqual(detailChanges(guessed, { title: read.title, price: null, images: [] }), [
    { field: "title", before: "Hatch Rest Sound Machine", after: read.title },
  ]);
});

test("the review knows which value the item shows", () => {
  const [title, price, photo] = detailChanges(guessed, read);
  const after = { title: read.title, price: 59.99, image_url: read.images[0] };
  assert.equal(shownSide(title, after), "after");
  assert.equal(shownSide(price, after), "after");
  assert.equal(shownSide(photo, after), "after");

  const putBack = { title: "Hatch Rest Sound Machine", price: null, image_url: null };
  assert.equal(shownSide(title, putBack), "before");
  assert.equal(shownSide(price, putBack), "before");
  assert.equal(shownSide(photo, putBack), "before");
});

test("a value edited since shows neither side", () => {
  const [title, price] = detailChanges(guessed, read);
  const edited = { title: "Sound machine for the nursery", price: 55, image_url: null };
  assert.equal(shownSide(title, edited), null);
  assert.equal(shownSide(price, edited), null);
});

test("a price read back from the database as text still matches", () => {
  const change = { field: "price" as const, before: 49.99, after: 59.99 };
  assert.equal(shownSide(change, { title: "", price: "59.99" as unknown as number, image_url: null }), "after");
});

test("saved changes are read back, and anything else is left out", () => {
  const saved = [
    { field: "title", before: "Old", after: "New" },
    { field: "price", before: null, after: 12.5 },
    { field: "image_url", before: null, after: "https://example.com/a.jpg" },
    { field: "notes", before: null, after: "Not a field a read changes" },
    { field: "price", before: null, after: "12.50" },
    { field: "title", before: "Old", after: "" },
    "not a change",
    null,
  ];
  assert.deepEqual(parseDetailChanges(saved), [
    { field: "title", before: "Old", after: "New" },
    { field: "price", before: null, after: 12.5 },
    { field: "image_url", before: null, after: "https://example.com/a.jpg" },
  ]);
  assert.deepEqual(parseDetailChanges({ field: "title" }), []);
  assert.deepEqual(parseDetailChanges(null), []);
});

// ── Checking prices ────────────────────────────────────────────────────

const now = new Date("2026-11-27T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

// An item added with all its details, two weeks ago.
const complete: PriceCheckItem = {
  title: "Hatch Rest Sound Machine",
  price: 69.99,
  image_url: "https://example.com/rest.jpg",
  is_parent_purchased: false,
  external_url: "https://www.amazon.com/dp/B0EXAMPLE1",
  created_at: daysAgo(14),
  quantity_needed: 1,
  quantity_fulfilled: 0,
};

const readOf = (overrides: Partial<LastRead>): LastRead => ({
  read_url: complete.external_url,
  read_at: daysAgo(1),
  changes: [],
  reviewed_at: daysAgo(1),
  ...overrides,
});

test("a price check changes the price only, never the name or photo", () => {
  const changes = priceChanges({ ...complete, image_url: null }, { ...read, title: "Robot Check" });
  assert.deepEqual(changes, [{ field: "price", before: 69.99, after: 59.99 }]);
  assert.deepEqual(priceChanges(complete, { ...read, price: 69.99 }), []);
  assert.deepEqual(priceChanges({ ...complete, is_parent_purchased: true }, read), []);
});

test("an item is checked a week after it was added or last read", () => {
  assert.equal(priceCheckDue(complete, undefined, now), true);
  assert.equal(priceCheckDue({ ...complete, created_at: daysAgo(PRICE_CHECK_DAYS - 1) }, undefined, now), false);
  assert.equal(priceCheckDue(complete, readOf({ read_at: daysAgo(2) }), now), false);
  assert.equal(priceCheckDue(complete, readOf({ read_at: daysAgo(PRICE_CHECK_DAYS) }), now), true);
});

test("a read of the item's old link doesn't count as a check", () => {
  const oldLink = readOf({ read_url: "https://www.amazon.com/dp/B0OLDLINK", read_at: daysAgo(1) });
  assert.equal(priceCheckDue(complete, oldLink, now), true);
  assert.equal(priceCheckDue({ ...complete, created_at: daysAgo(1) }, oldLink, now), false);
});

test("bought and fully given items aren't checked", () => {
  assert.equal(priceCheckDue({ ...complete, is_parent_purchased: true }, undefined, now), false);
  assert.equal(priceCheckDue({ ...complete, quantity_fulfilled: 1 }, undefined, now), false);
  assert.equal(priceCheckDue({ ...complete, quantity_needed: 3, quantity_fulfilled: 1 }, undefined, now), true);
});

test("an item waiting for review isn't checked again", () => {
  const waiting = readOf({ read_at: daysAgo(30), reviewed_at: null, changes: [{ field: "price", before: 79.99, after: 69.99 }] });
  assert.equal(priceCheckDue(complete, waiting, now), false);
});

test("switching back to your own price doesn't stop checks, but the same store price changes nothing", () => {
  // complete shows 69.99, its own price; the last check found 59.99.
  const changes: DetailChange[] = [{ field: "price", before: 69.99, after: 59.99 }];
  const last = readOf({ read_at: daysAgo(30), changes });
  assert.equal(priceCheckDue(complete, last, now), true);
  // The store still says 59.99: nothing to offer.
  assert.equal(turnedDownBefore(complete, last, [{ field: "price", before: 69.99, after: 59.99 }]), true);
  // The store says something else now: offer it.
  assert.equal(turnedDownBefore(complete, last, [{ field: "price", before: 69.99, after: 54.99 }]), false);
  // Kept the new price, or the read was of an old link: nothing was turned down.
  assert.equal(turnedDownBefore({ ...complete, price: 59.99 }, last, [{ field: "price", before: 59.99, after: 64.99 }]), false);
  assert.equal(turnedDownBefore(complete, { ...last, read_url: "https://www.amazon.com/dp/B0OLDLINK" }, changes), false);
  // Took out a price that filled an empty one: that's no price the owner chose.
  const filled = readOf({ changes: [{ field: "price", before: null, after: 59.99 }] });
  assert.equal(turnedDownBefore({ ...complete, price: null }, filled, [{ field: "price", before: null, after: 59.99 }]), false);
});

test("turning off an item's price checks lasts until its link changes", () => {
  const off = readOf({ read_at: daysAgo(30), price_checks_off_url: complete.external_url });
  assert.equal(priceChecksOff(complete, off), true);
  assert.equal(priceCheckDue(complete, off, now), false);
  const newLink = { ...complete, external_url: "https://www.target.com/p/-/A-12345678" };
  assert.equal(priceChecksOff(newLink, off), false);
  assert.equal(priceCheckDue(newLink, off, now), true);
  assert.equal(priceChecksOff(complete, readOf({ price_checks_off_url: null })), false);
});

test("the edit dialog shows the price check setting once the extension has read the link", () => {
  assert.equal(priceCheckSetting(complete, undefined), null);
  assert.equal(priceCheckSetting(complete, readOf({})), "on");
  assert.equal(priceCheckSetting(complete, readOf({ read_url: "https://www.amazon.com/dp/B0OLDLINK" })), null);
  assert.equal(priceCheckSetting(complete, readOf({ price_checks_off_url: complete.external_url })), "off");
  // Turned off for an old link: the new one hasn't been read yet.
  const offForOld = readOf({ read_url: "https://www.amazon.com/dp/B0OLDLINK", price_checks_off_url: "https://www.amazon.com/dp/B0OLDLINK" });
  assert.equal(priceCheckSetting(complete, offForOld), null);
  assert.equal(priceCheckSetting({ ...complete, is_parent_purchased: true }, readOf({})), null);
});

test("a review of new prices alone is headed as one", () => {
  const price = { field: "price" as const, before: 69.99 };
  assert.equal(detailReviewHeading([{ changes: [price] }]), "New price for 1 item");
  assert.equal(detailReviewHeading([{ changes: [price] }, { changes: [price] }]), "New prices for 2 items");
  assert.equal(detailReviewHeading([{ changes: [price] }, { changes: [{ field: "title", before: "A" }] }]), "Filled in details for 2 items");
  assert.equal(detailReviewHeading([{ changes: [{ field: "price", before: null }] }]), "Filled in details for 1 item");
});
