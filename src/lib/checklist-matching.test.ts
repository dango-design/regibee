import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CHECKLIST, checklistPrice, checklistQuantity } from "./checklist-data.ts";
import {
  CHECKLIST_NONE,
  checklistStatus,
  countedEntry,
  dismissedEntryKeys,
  guessChecklistEntry,
  specificQuestion,
} from "./checklist-matching.ts";

const item = (title: string) => guessChecklistEntry(title, "item");

test("every entry has a unique key in the saved format", () => {
  const keys = DEFAULT_CHECKLIST.flatMap((c) => c.items.map((e) => e.key));
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) assert.match(key, /^[a-z0-9-]{1,60}$/);
  assert.ok(!keys.includes(CHECKLIST_NONE));
});

test("each entry's own name counts for that entry and no other", () => {
  for (const category of DEFAULT_CHECKLIST) {
    for (const entry of category.items) {
      const kind = entry.fund ? "fund" : "item";
      assert.equal(guessChecklistEntry(entry.name, kind), entry.key, entry.name);
    }
  }
});

test("a more specific entry wins over a shorter one it contains", () => {
  assert.equal(item("Newton Baby Crib Mattress"), "crib-mattress");
  assert.equal(item("Babyletto Hudson 3-in-1 Convertible Crib"), "crib");
  assert.equal(item("Burt's Bees Fitted Crib Sheets, 2 pack"), "fitted-crib-sheets");
  assert.equal(item("Graco Pack 'n Play Playard"), "play-yard");
  assert.equal(item("Keekaroo Changing Pad Cover"), "changing-pad-covers");
  assert.equal(item("Skip Hop Stroller Organizer"), "stroller-organizer");
  assert.equal(item("Frida Mom Peri Bottle"), "peri-bottle");
});

test("sizes have to match", () => {
  assert.equal(item("Pampers Swaddlers Diapers Size 1, 198 Count"), "diapers-size-1");
  assert.equal(item("Pampers Swaddlers Diapers Size 2"), "diapers-size-2");
  assert.equal(item("Huggies Little Snugglers Newborn Diapers"), "diapers-newborn");
  assert.equal(item("Carter's Footed Sleepers 3-6 Months"), "sleepers-footies-3-6m");
  assert.equal(item("Carter's 5-Pack Onesies (0-3 mo)"), "bodysuits-0-3m");
});

test("new names, other names and old names all match", () => {
  assert.equal(item("Carter's Baby 5-Pack Short-Sleeve Bodysuits 0-3 Months"), "bodysuits-0-3m");
  assert.equal(item("UPPAbaby Vista V3 Stroller"), "full-size-stroller");
  assert.equal(item("Halo SleepSack Wearable Blanket"), "sleep-sacks");
  assert.equal(item("Munchkin Miracle 360 Sippy Cup"), "baby-cups");
  assert.equal(item("Fisher-Price Activity Gym"), "play-gym");
  assert.equal(item("Tiny Love Car Seat Mirror"), "car-seat-camera-mirror");
  assert.equal(item("Dreft Laundry Detergent"), "fragrance-free-detergent");
});

test("plurals and singulars meet", () => {
  assert.equal(item("Hooded Baby Towel"), "hooded-towels");
  assert.equal(item("Dr. Brown's Anti-Colic Bottles"), "bottles");
  assert.equal(item("Philips Avent Bottle"), "bottles");
  assert.equal(item("MAM Pacifier"), "pacifiers");
});

test("a short or unrelated title matches nothing", () => {
  assert.equal(item("Car"), null);
  assert.equal(item("Mat"), null);
  assert.equal(item("Gift"), null);
  assert.equal(item(""), null);
});

test("a fund only counts for a fund entry, an item only for an item entry", () => {
  assert.equal(guessChecklistEntry("Diaper Fund", "fund"), "diaper-fund");
  assert.equal(guessChecklistEntry("Diaper Fund", "item"), null);
  assert.equal(guessChecklistEntry("Crib", "fund"), null);
});

test("a saved choice wins over the title, and 'none' counts for nothing", () => {
  assert.deepEqual(countedEntry({ id: "1", kind: "item", title: "Crib", checklist_entry: "bassinet" }), {
    key: "bassinet",
    chosen: true,
  });
  assert.deepEqual(countedEntry({ id: "1", kind: "item", title: "Crib", checklist_entry: CHECKLIST_NONE }), {
    key: null,
    chosen: true,
  });
  // A key that isn't on the checklist, or takes the other kind, falls back to the title.
  assert.deepEqual(countedEntry({ id: "1", kind: "item", title: "Crib", checklist_entry: "gone-now" }), {
    key: "crib",
    chosen: false,
  });
  assert.deepEqual(countedEntry({ id: "1", kind: "item", title: "Crib", checklist_entry: "diaper-fund" }), {
    key: "crib",
    chosen: false,
  });
});

test("adding Crib marks only Crib as done", () => {
  const status = checklistStatus([{ id: "1", kind: "item", title: "Crib" }]);
  assert.equal(status.done, 1);
  assert.deepEqual(Object.keys(status.byEntry), ["crib"]);
});

test("each item counts once, and unmatched ones are listed", () => {
  const status = checklistStatus([
    { id: "1", kind: "item", title: "Crib" },
    { id: "2", kind: "item", title: "Another crib" },
    { id: "3", kind: "item", title: "Lamp" },
    { id: "4", kind: "item", title: "Swaddles", checklist_entry: CHECKLIST_NONE },
  ]);
  assert.deepEqual(status.byEntry.crib.map((c) => c.id), ["1", "2"]);
  assert.deepEqual(status.uncounted.map((c) => c.id), ["3", "4"]);
  assert.equal(status.done, 1);
});

test("an entry that's added and marked as registered counts once", () => {
  const status = checklistStatus([{ id: "1", kind: "item", title: "Crib" }], ["crib", "bassinet"]);
  assert.equal(status.done, 2);
});

test("marked as registered reads keys and the lowercased names older lists saved", () => {
  assert.deepEqual([...dismissedEntryKeys(["glider / rocker", "crib-mattress", 7, "nothing"])].sort(), [
    "crib-mattress",
    "glider-rocker",
  ]);
  // Entries renamed or merged since keep counting under their old names.
  assert.deepEqual([...dismissedEntryKeys(["onesies (0-3m)", "teething toys", "car seat mirror"])].sort(), [
    "bodysuits-0-3m",
    "car-seat-camera-mirror",
    "teethers",
  ]);
  assert.equal(dismissedEntryKeys(null).size, 0);
});

test("quantities and prices say what they count", () => {
  assert.equal(checklistQuantity({ suggestedQuantity: 2, unit: ["box", "boxes"] }), "2 boxes");
  assert.equal(checklistQuantity({ suggestedQuantity: 1, unit: ["box", "boxes"] }), "1 box");
  assert.equal(checklistQuantity({ suggestedQuantity: 2 }), "2");
  assert.equal(checklistPrice({ suggestedPrice: "$30-45", unit: ["box", "boxes"] }), "$30-45 per box");
  assert.equal(checklistPrice({ suggestedPrice: "$150-600" }), "$150-600");
  assert.equal(checklistPrice({ suggestedPrice: "Any amount", unit: ["box", "boxes"] }), "Any amount");
});

test("every source link is https", () => {
  for (const category of DEFAULT_CHECKLIST) {
    for (const entry of category.items) {
      for (const source of entry.sources ?? []) assert.match(source.url, /^https:\/\//, entry.name);
    }
  }
});

test("the question names the first thing an entry names", () => {
  assert.equal(specificQuestion({ name: "Crib", suggestedQuantity: 1 }), "Have a specific crib in mind?");
  assert.equal(specificQuestion({ name: "Swaddles", suggestedQuantity: 6 }), "Have specific swaddles in mind?");
  assert.equal(specificQuestion({ name: "Glider / Rocker", suggestedQuantity: 1 }), "Have a specific glider in mind?");
  assert.equal(specificQuestion({ name: "Onesies (0-3m)", suggestedQuantity: 10 }), "Have specific onesies in mind?");
  assert.equal(specificQuestion({ name: "Diapers — Size 1", suggestedQuantity: 3 }), "Have specific diapers in mind?");
  assert.equal(specificQuestion({ name: "Glass", suggestedQuantity: 1 }), "Have a specific glass in mind?");
});
