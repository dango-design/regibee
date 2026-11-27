// Run with: node --test src/lib/gifts.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fundAsUnpledged,
  fundsPosition,
  guestItemStatus,
  hidesReservations,
  itemAsUnreserved,
  readReservationPrivacy,
  reservationsHiddenFrom,
  settingsAfterJoiningExchange,
} from "./gifts.ts";

const OWNER = "owner-id";
const MANAGER = "manager-id";

test("reservations show by default", () => {
  assert.equal(hidesReservations({}), false);
  assert.equal(hidesReservations(null), false);
  assert.equal(reservationsHiddenFrom({ owner_id: OWNER, settings: {} }, OWNER), false);
});

test("hiding applies to the owner only", () => {
  const registry = { owner_id: OWNER, settings: { hide_reservations: true } };
  assert.equal(reservationsHiddenFrom(registry, OWNER), true);
  assert.equal(reservationsHiddenFrom(registry, MANAGER), false);
  assert.equal(reservationsHiddenFrom(registry, null), false);
  assert.equal(reservationsHiddenFrom(registry, undefined), false);
});

test("a list kept for a child always shows reservations", () => {
  const registry = { owner_id: OWNER, settings: { hide_reservations: true, for_child: true } };
  assert.equal(hidesReservations(registry.settings), false);
  assert.equal(reservationsHiddenFrom(registry, OWNER), false);
});

test("reads only the values it knows", () => {
  assert.deepEqual(readReservationPrivacy({ hide_reservations: "yes", hide_reservations_source: "guest", for_child: 1 }), {
    hide_reservations: undefined,
    hide_reservations_source: undefined,
    for_child: false,
  });
  assert.deepEqual(readReservationPrivacy({ hide_reservations: false, hide_reservations_source: "owner" }), {
    hide_reservations: false,
    hide_reservations_source: "owner",
    for_child: false,
  });
});

test("an item shows nothing reserved, unless the owner bought it", () => {
  assert.equal(itemAsUnreserved({ quantity_fulfilled: 2, is_parent_purchased: false }).quantity_fulfilled, 0);
  assert.equal(itemAsUnreserved({ quantity_fulfilled: 3, is_parent_purchased: true }).quantity_fulfilled, 3);
  assert.equal(fundAsUnpledged({ current_amount: 75, title: "Trip" }).current_amount, 0);
});

test("joining a gift exchange turns hiding on for a personal wishlist", () => {
  assert.deepEqual(settingsAfterJoiningExchange({ registry_type: "personal", settings: { zip_code: "94110" } }), {
    zip_code: "94110",
    hide_reservations: true,
    hide_reservations_source: "exchange",
  });
});

test("joining a gift exchange leaves other lists alone", () => {
  // A baby registry: its owners need to see gifts for thank-you notes.
  assert.equal(settingsAfterJoiningExchange({ registry_type: "baby", settings: {} }), null);
  // The owner already chose, either way.
  assert.equal(settingsAfterJoiningExchange({ registry_type: "personal", settings: { hide_reservations: false } }), null);
  assert.equal(settingsAfterJoiningExchange({ registry_type: "personal", settings: { hide_reservations: true } }), null);
  // A list kept for a child.
  assert.equal(settingsAfterJoiningExchange({ registry_type: "personal", settings: { for_child: true } }), null);
});

// ── guestItemStatus ─────────────────────────────────────────────────────

const open = { quantity_needed: 2, quantity_fulfilled: 0, is_essential: false, is_parent_purchased: false };

test("an open item says how many are still needed and offers its buttons", () => {
  const s = guestItemStatus(open, { groupGiftsOn: true });
  assert.equal(s.quantity, "2 of 2 still needed");
  assert.equal(s.tag, null);
  assert.equal(s.showsActions, true);
  assert.equal(s.canStartGroupGift, true);
  assert.equal(s.looksDone, false);
});

test("a most wanted item is tagged until it's taken", () => {
  assert.deepEqual(guestItemStatus({ ...open, is_essential: true }).tag, { kind: "most-wanted", label: "Most wanted" });
  assert.deepEqual(guestItemStatus({ ...open, is_essential: true, quantity_fulfilled: 2 }).tag, { kind: "gifted", label: "Gifted" });
});

test("a taken item reads as reserved while another guest only holds it", () => {
  const taken = { ...open, quantity_fulfilled: 2 };
  assert.deepEqual(guestItemStatus(taken, { reservedQty: 1 }).tag, { kind: "reserved", label: "Reserved by a guest" });
  const s = guestItemStatus(taken);
  assert.equal(s.showsActions, false);
  assert.equal(s.looksDone, true);
});

test("the guest's own reservation and gift", () => {
  const reserved = guestItemStatus(open, {
    gift: { purchaseId: "p", status: "reserved", reservedUntil: null, quantity: 1 },
    groupGiftsOn: true,
  });
  assert.deepEqual(reserved.tag, { kind: "reserved", label: "Reserved for you" });
  assert.equal(reserved.myReservation, true);
  assert.equal(reserved.canStartGroupGift, false);

  const given = guestItemStatus({ ...open, quantity_fulfilled: 2 }, {
    gift: { purchaseId: "p", status: "purchased", reservedUntil: null, quantity: 2 },
  });
  assert.deepEqual(given.tag, { kind: "purchased-by-you", label: "You gifted this" });
  assert.equal(given.itemPurchased, true);
  // Still shows "View your gift", though nothing is left.
  assert.equal(given.showsActions, true);
});

test("an item the owners bought counts what guests covered", () => {
  const bought = { ...open, is_parent_purchased: true };
  const s = guestItemStatus(bought, { coveredQty: 1, selfPurchasedLabel: "Already bought", groupGiftsOn: true });
  assert.equal(s.quantity, "1 of 2 available to gift");
  assert.deepEqual(s.tag, { kind: "parent-purchased", label: "Already bought" });
  assert.equal(s.canStartGroupGift, false);
  assert.equal(guestItemStatus(bought, { coveredQty: 2 }).looksDone, true);
  // A cover saved before the cookie held purchase ids.
  assert.equal(guestItemStatus(bought, { cookieValue: "cover" }).itemPurchased, true);
});

test("the guest's group gift replaces the reserve buttons", () => {
  const s = guestItemStatus({ ...open, quantity_fulfilled: 2 }, { groupGift: { token: "t", organizer: true }, groupGiftsOn: true });
  assert.deepEqual(s.tag, { kind: "reserved", label: "Your group gift" });
  assert.equal(s.showsActions, true);
  assert.equal(s.looksDone, false);
});

test("gift funds stay at the top unless the list moved them to the bottom", () => {
  assert.equal(fundsPosition(null), "top");
  assert.equal(fundsPosition({}), "top");
  assert.equal(fundsPosition({ funds_position: "bottom" }), "bottom");
  assert.equal(fundsPosition({ funds_position: "middle" }), "top");
});
