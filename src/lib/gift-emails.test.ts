// Run with: node --test src/lib/gift-emails.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { digestSubject, groupDigest, parseGiftEmails, thanksReminderDue, type DigestGift } from "./gift-emails.ts";

const gift = (registryId: string, shownName: string): DigestGift => ({
  registryId,
  shownName,
  title: "Panda Lovey",
  kind: "given",
  quantity: 1,
  amount: null,
  message: null,
  imageUrl: null,
});

test("parseGiftEmails falls back to one email per gift", () => {
  assert.equal(parseGiftEmails("daily"), "daily");
  assert.equal(parseGiftEmails("off"), "off");
  assert.equal(parseGiftEmails("weekly"), "instant");
  assert.equal(parseGiftEmails(null), "instant");
});

test("groupDigest groups by list in the order gifts came, and drops lists it can't name", () => {
  const titles = new Map([
    ["a", "Remi's Baby Registry"],
    ["b", "Max's Birthday Wishlist"],
  ]);
  const lists = groupDigest([gift("b", "Oz"), gift("a", "Glinda"), gift("b", "Boq"), gift("gone", "Nessa")], titles);
  assert.deepEqual(
    lists.map((l) => [l.title, l.gifts.map((g) => g.shownName)]),
    [
      ["Max's Birthday Wishlist", ["Oz", "Boq"]],
      ["Remi's Baby Registry", ["Glinda"]],
    ],
  );
});

test("digestSubject names one list, or says your lists", () => {
  const titles = new Map([
    ["a", "Remi's Baby Registry"],
    ["b", "Max's Wishlist"],
  ]);
  assert.equal(digestSubject(groupDigest([gift("a", "Oz")], titles)), "1 new gift on Remi's Baby Registry");
  assert.equal(digestSubject(groupDigest([gift("a", "Oz"), gift("a", "Boq")], titles)), "2 new gifts on Remi's Baby Registry");
  assert.equal(digestSubject(groupDigest([gift("a", "Oz"), gift("b", "Boq")], titles)), "2 new gifts on your lists");
});

test("thanksReminderDue: from 3 days after the list's date, once, only with gifts and nothing hidden", () => {
  const list = { event_date: "2026-12-01", thanks_reminded_for: null, hidesReservations: false, giftCount: 4 };
  assert.equal(thanksReminderDue(list, "2026-12-03"), false);
  assert.equal(thanksReminderDue(list, "2026-12-04"), true);
  assert.equal(thanksReminderDue(list, "2026-12-11"), true, "a week late still sends it");
  assert.equal(thanksReminderDue(list, "2026-12-12"), false);
  assert.equal(thanksReminderDue({ ...list, thanks_reminded_for: "2026-12-01" }, "2026-12-04"), false);
  assert.equal(thanksReminderDue({ ...list, thanks_reminded_for: "2025-12-01" }, "2026-12-04"), true, "a new year's date sends again");
  assert.equal(thanksReminderDue({ ...list, giftCount: 0 }, "2026-12-04"), false);
  assert.equal(thanksReminderDue({ ...list, hidesReservations: true }, "2026-12-04"), false);
  assert.equal(thanksReminderDue({ ...list, event_date: null }, "2026-12-04"), false);
});
