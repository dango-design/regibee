// Run with: node --test src/lib/occasions.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  LIST_OCCASIONS,
  OCCASIONS,
  OCCASION_IDS,
  countdownLabel,
  giftPlanLabel,
  giftPlanRows,
  giftPlansFor,
  listTint,
  listTitleFor,
  occasionFor,
  planNeedsEvent,
  startingExchange,
  startingGiftPlan,
} from "./occasions.ts";

const MIGRATIONS = new URL("../../supabase/migrations/", import.meta.url);

/** The values in the newest check constraint with this name, from the migration files. */
function constraintValues(name: string): string[] {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  let values: string[] = [];
  for (const file of files) {
    const sql = readFileSync(new URL(file, MIGRATIONS), "utf8");
    const at = sql.lastIndexOf(name);
    if (at === -1) continue;
    const list = sql.slice(at).match(/in\s*\(([^)]*)\)/);
    if (list) values = [...list[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  }
  return values;
}

test("every occasion is an event type the database allows, and the other way round", () => {
  assert.deepEqual([...OCCASION_IDS].sort(), constraintValues("events_event_type_check").sort());
});

test("every list occasion is a registry event type the database allows", () => {
  // 009_registry_types.sql lists them inline on registries.event_type.
  const sql = readFileSync(new URL("009_registry_types.sql", MIGRATIONS), "utf8");
  const values = [...sql.slice(sql.indexOf("add column event_type")).matchAll(/'([a-z_]+)'/g)]
    .map((m) => m[1])
    .filter((v) => v !== "baby" && v !== "personal");
  assert.deepEqual([...LIST_OCCASIONS].sort(), [...new Set(values)].sort());
});

test("each occasion's list is a kind of list a registry can store", () => {
  for (const occasion of OCCASIONS) {
    if (occasion.list.registryType === "baby") assert.equal(occasion.list.eventType, null, occasion.id);
    else assert.ok((LIST_OCCASIONS as readonly string[]).includes(occasion.list.eventType ?? ""), occasion.id);
    assert.ok(occasion.audiences.length > 0, occasion.id);
  }
});

test("colors match what registries and events showed before the lists merged", () => {
  assert.equal(occasionFor("baby_shower").tint, "blush");
  assert.equal(occasionFor("kids_birthday").tint, "sunshine");
  assert.equal(occasionFor("holiday").tint, "mint");
  assert.equal(occasionFor("wedding").tint, "teal");
  assert.equal(listTint("baby", null), "blush");
  assert.equal(listTint("personal", "birthday"), "sunshine");
  assert.equal(listTint("personal", "christmas"), "mint");
  assert.equal(listTint("personal", "graduation"), "teal");
});

test("titles read naturally, with or without a name", () => {
  assert.equal(occasionFor("baby_shower").titleFor("Remi"), "Remi's Baby Shower");
  assert.equal(occasionFor("birthday").titleFor("James"), "James' Birthday");
  assert.equal(occasionFor("birthday").titleFor(""), "Birthday");
  assert.equal(listTitleFor(occasionFor("baby_shower"), "Remi & Max"), "Remi & Max's Baby Registry");
  assert.equal(listTitleFor(occasionFor("kids_birthday"), "Jordan"), "Jordan's Birthday Wishlist");
});

test("gift plans fit who it's for", () => {
  assert.deepEqual(giftPlansFor("someone"), ["link", "ask", "no_gifts", "later"]);
  assert.ok(giftPlansFor("child").includes("new_list"));
  assert.deepEqual(giftPlansFor("everyone"), ["everyone", "exchange", "later"]);
  // Skipping the gifts step works for everyone.
  for (const audience of ["me", "us", "child", "someone", "everyone", "no_one"] as const) {
    assert.ok(giftPlansFor(audience).includes("later"), `${audience} can't skip gifts`);
  }
  // A party for no one in particular can still use wishlists: linked, or one per guest with a name draw.
  assert.deepEqual(giftPlansFor("no_one", occasionFor("christmas")), ["link", "exchange", "signup", "no_gifts", "later"]);
  // A potluck or meal train offers its sign-up sheet first.
  assert.deepEqual(giftPlansFor("no_one", occasionFor("potluck")), ["signup", "link", "exchange", "no_gifts", "later"]);
  assert.equal(giftPlansFor("someone", occasionFor("meal_train"))[0], "signup");
  assert.ok(!giftPlansFor("someone", occasionFor("baby_shower")).includes("signup"));
  assert.equal(planNeedsEvent("new_list"), false);
  assert.equal(planNeedsEvent("ask"), true);
});

test("Christmas and a holiday party start with each guest linking their own wish list", () => {
  for (const id of ["christmas", "holiday_party"] as const) {
    const occasion = occasionFor(id);
    // The picker asks who it's for, with everyone taking part first...
    assert.equal(occasion.audiences[0], "everyone", id);
    // ...and starts with everyone giving everyone picked, which the host can change.
    assert.equal(startingGiftPlan("everyone", occasion), "everyone", id);
    assert.ok(giftPlansFor("everyone", occasion).includes("exchange"), `${id} can draw names instead`);
    // The event form starts with guests giving each other gifts, the same way.
    assert.deepEqual(startingExchange(id), { on: true, kind: "everyone" }, id);
  }
  // Christmas for one person is their own list, so nothing starts picked.
  for (const audience of ["no_one", "me", "us", "child"] as const) {
    assert.equal(startingGiftPlan(audience, occasionFor("christmas")), null, audience);
  }
  assert.equal(startingGiftPlan("no_one", occasionFor("holiday_party")), null);
});

test("other occasions start the way they did", () => {
  // A gift exchange draws names.
  assert.equal(startingGiftPlan("everyone", occasionFor("gift_exchange")), "exchange");
  assert.deepEqual(startingExchange("gift_exchange"), { on: true, kind: "draw" });
  // "Other holiday", like a Lunar New Year dinner, has no exchange to start with.
  assert.equal(occasionFor("holiday").label, "Other holiday");
  assert.deepEqual(startingExchange("holiday"), { on: false, kind: "everyone" });
  for (const { id } of OCCASIONS) {
    if (id === "christmas" || id === "holiday_party" || id === "gift_exchange") continue;
    const occasion = occasionFor(id);
    assert.deepEqual(startingExchange(id), { on: false, kind: "everyone" }, id);
    for (const audience of occasion.audiences) assert.equal(startingGiftPlan(audience, occasion), null, `${id} for ${audience}`);
  }
  // An unknown type starts with nothing.
  assert.deepEqual(startingExchange("not_an_occasion"), { on: false, kind: "everyone" });
});

test("a holiday party is its own occasion, next to Christmas", () => {
  const ids = OCCASIONS.map((o) => o.id) as string[];
  assert.equal(ids.indexOf("holiday_party"), ids.indexOf("christmas") + 1);
  const party = occasionFor("holiday_party");
  assert.equal(party.label, "Holiday party");
  assert.equal(party.tint, "mint");
  assert.equal(party.titleFor("The Chens"), "The Chens' Holiday Party");
  assert.equal(party.titleFor(""), "Holiday Party");
  assert.deepEqual(giftPlansFor("everyone", party), ["everyone", "exchange", "later"]);
  // A work holiday party, for no one in particular, can draw names or share a sign-up sheet.
  assert.deepEqual(giftPlansFor("no_one", party), ["link", "exchange", "signup", "no_gifts", "later"]);
});

test("gift lists come first, and every audience with gifts has one", () => {
  for (const { id } of OCCASIONS) {
    const occasion = occasionFor(id);
    for (const audience of occasion.audiences) {
      const { main, other } = giftPlanRows(audience, occasion);
      assert.ok(main.some((plan) => plan !== "signup"), `${occasion.id} for ${audience} has no gift list`);
      // Every plan but "later", which is the Skip button.
      assert.deepEqual(
        [...main, ...other].sort(),
        giftPlansFor(audience, occasion)
          .filter((plan) => plan !== "later")
          .sort(),
      );
    }
  }
  assert.deepEqual(giftPlanRows("no_one", occasionFor("christmas")), {
    main: ["link", "exchange"],
    other: ["signup", "no_gifts"],
  });
  // A potluck's sheet stays up front with the lists.
  assert.deepEqual(giftPlanRows("no_one", occasionFor("potluck")).main, ["signup", "link", "exchange"]);
});

test("a gift plan's label fits who it's for", () => {
  const birthday = occasionFor("birthday");
  assert.equal(giftPlanLabel("new_list", "child", birthday).label, "Make their birthday wishlist");
  assert.equal(giftPlanLabel("link", "me", birthday).label, "Link a list");
  assert.equal(giftPlanLabel("link", "me", birthday, true).label, "Use a list you already have");
  assert.equal(giftPlanLabel("link", "someone", birthday, true).label, "Link their list");
  assert.equal(giftPlanLabel("link", "no_one", birthday).label, "Link a wishlist");
});

test("the countdown shows the date with its year once it has gone by", () => {
  assert.equal(countdownLabel("2026-11-03", "2026-11-19", "baby"), "Nov 3, 2026");
  assert.equal(countdownLabel("2026-11-03", "2026-11-19", "personal"), "Nov 3, 2026");
  assert.equal(countdownLabel("2025-12-31", "2026-01-01", "baby"), "Dec 31, 2025");
  assert.equal(countdownLabel("2026-11-19", "2026-11-19", "baby"), "Due today");
  assert.equal(countdownLabel("2026-11-20", "2026-11-19", "personal"), "Tomorrow");
  assert.equal(countdownLabel("2026-12-01", "2026-11-19", "baby"), "Due in 12 days");
});
