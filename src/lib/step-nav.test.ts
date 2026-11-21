// Run with: node --test src/lib/step-nav.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { isFinishedDate, nextUnvisited, stepFooterLabel, stepNavReducer, stepStatus, type StepNav } from "./step-nav.ts";

type Id = "what" | "name" | "place" | "rsvps";
const ORDER: Id[] = ["what", "name", "place", "rsvps"];
const nav = (open: Id | null, visited: Id[] = []): StepNav<Id> => ({ open, visited: new Set(visited) });

test("finishing a step opens the next one the person hasn't been to", () => {
  assert.deepEqual(stepNavReducer(ORDER, nav("what"), { type: "finish", id: "what" }), nav("name", ["what"]));
  // "place" was already visited, so "rsvps" is next.
  assert.deepEqual(stepNavReducer(ORDER, nav("name", ["what", "place"]), { type: "finish", id: "name" }), nav("rsvps", ["what", "place", "name"]));
  // With every later step visited, it goes back to the first one left.
  assert.deepEqual(stepNavReducer(ORDER, nav("rsvps", ["what", "place"]), { type: "finish", id: "rsvps" }), nav("name", ["what", "place", "rsvps"]));
  // With none left, every step closes.
  assert.deepEqual(stepNavReducer(ORDER, nav("rsvps", ["what", "name", "place"]), { type: "finish", id: "rsvps" }).open, null);
});

test("a late finish from a step the person already left does nothing", () => {
  const state = nav("place", ["what", "name"]);
  assert.equal(stepNavReducer(ORDER, state, { type: "finish", id: "what" }), state);
});

test("opening another step counts the open one as visited", () => {
  assert.deepEqual(stepNavReducer(ORDER, nav("what"), { type: "toggle", id: "rsvps" }), nav("rsvps", ["what"]));
  assert.deepEqual(stepNavReducer(ORDER, nav("rsvps", ["what"]), { type: "toggle", id: "rsvps" }), nav(null, ["what", "rsvps"]));
  assert.deepEqual(stepNavReducer(ORDER, nav(null), { type: "open", id: "name" }), nav("name"));
});

test("a step that's no longer shown is skipped over", () => {
  // Like gifts among the guests, after the occasion changes.
  assert.equal(nextUnvisited(["what", "name", "rsvps"] as Id[], "place", new Set<Id>(["what"])), "name");
});

test("each step's status and button follow what's in it", () => {
  const required = { complete: false, optional: false, hasContent: false };
  const empty = { complete: true, optional: true, hasContent: false };
  const filled = { complete: true, optional: true, hasContent: true };
  const state = nav("place", ["what", "name"]);
  assert.equal(stepStatus(state, "place", empty), "open");
  assert.equal(stepStatus(state, "rsvps", filled), "upcoming");
  assert.equal(stepStatus(state, "name", required), "incomplete");
  assert.equal(stepStatus(state, "what", empty), "skipped");
  assert.equal(stepStatus(state, "what", filled), "done");

  assert.equal(stepFooterLabel(ORDER, state, "place", empty), "Skip");
  assert.equal(stepFooterLabel(ORDER, state, "place", filled), "Continue");
  assert.equal(stepFooterLabel(ORDER, nav("rsvps", ["what", "name", "place"]), "rsvps", filled), "Done");
});

test("a date counts as finished once its year has four real digits", () => {
  assert.equal(isFinishedDate("2027-03-14"), true);
  assert.equal(isFinishedDate("0202-03-14"), false);
  assert.equal(isFinishedDate(""), false);
});
