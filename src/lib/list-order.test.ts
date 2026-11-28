// Run with: node --test src/lib/list-order.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanListOrder, moveList, orderLists, orderProfileLists } from "./list-order.ts";

const ids = (lists: { id: string }[]) => lists.map((list) => list.id);
const lists = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("orderLists keeps the order it was given when nothing is saved", () => {
  assert.deepEqual(ids(orderLists(lists, null)), ["a", "b", "c"]);
  assert.deepEqual(ids(orderLists(lists, [])), ["a", "b", "c"]);
});

test("orderLists follows the saved order", () => {
  assert.deepEqual(ids(orderLists(lists, ["c", "a", "b"])), ["c", "a", "b"]);
});

test("orderLists puts lists missing from the order first, and skips unknown ids", () => {
  assert.deepEqual(ids(orderLists(lists, ["gone", "b", "a"])), ["c", "b", "a"]);
});

const listed = (id: string, title: string, event_date: string | null) => ({
  id,
  slug: id,
  title,
  event_date,
  registry_type: "personal" as const,
  event_type: null,
  is_public: false,
});

test("orderProfileLists sorts by date with no saved order", () => {
  const today = "2026-11-28";
  const result = orderProfileLists(
    [listed("past", "Past", "2026-01-01"), listed("none", "No date", null), listed("soon", "Soon", "2026-12-01")],
    null,
    today,
  );
  assert.deepEqual(ids(result), ["soon", "none", "past"]);
});

test("orderProfileLists follows a saved order, with new lists first by date", () => {
  const today = "2026-11-28";
  const result = orderProfileLists(
    [
      listed("past", "Past", "2026-01-01"),
      listed("none", "No date", null),
      listed("soon", "Soon", "2026-12-01"),
      listed("later", "Later", "2027-03-01"),
    ],
    ["past", "none"],
    today,
  );
  assert.deepEqual(ids(result), ["soon", "later", "past", "none"]);
});

test("moveList moves one place, and not past either end", () => {
  assert.deepEqual(moveList(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveList(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(moveList(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(moveList(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
  assert.deepEqual(moveList(["a", "b", "c"], "x", 1), ["a", "b", "c"]);
});

test("cleanListOrder keeps allowed ids once, in order", () => {
  const allowed = new Set(["a", "b", "c"]);
  assert.deepEqual(cleanListOrder(["c", "x", "a", "c"], allowed), ["c", "a"]);
  assert.equal(cleanListOrder("a,b", allowed), null);
  assert.equal(cleanListOrder([1, 2], allowed), null);
});
