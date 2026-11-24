// Run with: node --test src/lib/delete-confirmation.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountHasData,
  deletePhrase,
  matchesDeletePhrase,
  registryDeletionLines,
  registryHasData,
} from "./delete-confirmation.ts";

const empty = { deletedItems: 0, movedItems: 0, placedItems: 0, funds: 0, gifts: 0 };

test("each thing has its own sentence", () => {
  assert.equal(deletePhrase("registry"), "I want to delete this registry");
  assert.equal(deletePhrase("event"), "I want to delete this event");
  assert.equal(deletePhrase("group"), "I want to delete this group");
  assert.equal(deletePhrase("account"), "I want to delete my account");
});

test("capitals, extra spaces and a full stop don't matter", () => {
  const phrase = deletePhrase("registry");
  assert.ok(matchesDeletePhrase("I want to delete this registry", phrase));
  assert.ok(matchesDeletePhrase("  i want  to delete this registry. ", phrase));
  assert.ok(matchesDeletePhrase("I WANT TO DELETE THIS REGISTRY", phrase));
});

test("anything else isn't the sentence", () => {
  const phrase = deletePhrase("registry");
  assert.equal(matchesDeletePhrase("", phrase), false);
  assert.equal(matchesDeletePhrase("delete", phrase), false);
  assert.equal(matchesDeletePhrase("I want to delete this", phrase), false);
  assert.equal(matchesDeletePhrase("I want to delete this event", phrase), false);
});

test("a registry holds something once it has an item or a gift fund", () => {
  assert.equal(registryHasData(empty), false);
  assert.ok(registryHasData({ ...empty, deletedItems: 1 }));
  assert.ok(registryHasData({ ...empty, movedItems: 1 }));
  assert.ok(registryHasData({ ...empty, placedItems: 1 }));
  assert.ok(registryHasData({ ...empty, funds: 1 }));
});

test("the lines say what goes and what stays", () => {
  assert.deepEqual(registryDeletionLines(empty), ["The registry's link stops working."]);
  assert.deepEqual(registryDeletionLines({ deletedItems: 12, movedItems: 2, placedItems: 1, funds: 1, gifts: 3 }), [
    "12 items and 1 gift fund are deleted.",
    "The 3 gifts guests reserved or gave are deleted, with their names and messages.",
    "3 items that are also on another list stay on those lists.",
    "The registry's link stops working.",
  ]);
  assert.deepEqual(registryDeletionLines({ ...empty, deletedItems: 1, gifts: 1 }), [
    "1 item is deleted.",
    "The gift a guest reserved or gave is deleted, with their name and message.",
    "The registry's link stops working.",
  ]);
  assert.deepEqual(registryDeletionLines({ ...empty, placedItems: 1 }), [
    "1 item that's also on another list stays on that list.",
    "The registry's link stops working.",
  ]);
});

test("an account holds something once it has a registry or an event", () => {
  const none = { deleted: [], handedOver: [], leaving: [], events: 0 };
  assert.equal(accountHasData(none), false);
  assert.ok(accountHasData({ ...none, events: 1 }));
  assert.ok(accountHasData({ ...none, deleted: [{ title: "Wishlist", gifts: 0 }] }));
  assert.ok(accountHasData({ ...none, leaving: [{ title: "Wishlist" }] }));
});
