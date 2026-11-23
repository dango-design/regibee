// Run with: node --test src/lib/guest-linked-lists.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { giveGuestsTheirLinkedLists } from "./guest-linked-lists.ts";

const guest = (guestId: string, list: { title: string; slug: string } | null = null) => ({
  guestId,
  name: guestId,
  url: list ? `https://regibee.com/r/${list.slug}` : null,
  registry: list,
});

const hostsList = { slug: "hosts-list-1a2b", title: "Host's Wishlist", ownerEmail: "Host@Example.com" };

test("a host on the guest list gets their linked list on their row", () => {
  const lists = [guest("host"), guest("brother")];
  const emails = new Map([
    ["host", " host@example.com "],
    ["brother", "brother@example.com"],
  ]);
  const result = giveGuestsTheirLinkedLists(lists, [hostsList], emails);
  assert.deepEqual(result[0].registry, { title: "Host's Wishlist", slug: "hosts-list-1a2b" });
  assert.equal(result[0].url, "/r/hosts-list-1a2b");
  assert.equal(result[0].name, "host");
  assert.equal(result[1].registry, null);
});

test("a guest's own wishlist stays, and the linked list keeps its own row", () => {
  const own = { title: "My Other List", slug: "other-list-9z8y" };
  const lists = [guest("host", own)];
  const result = giveGuestsTheirLinkedLists(lists, [hostsList], new Map([["host", "host@example.com"]]));
  assert.deepEqual(result[0].registry, own);
});

test("a list that's already someone's wishlist isn't given to a second guest", () => {
  const lists = [guest("brother", { title: "Host's Wishlist", slug: "hosts-list-1a2b" }), guest("host")];
  const emails = new Map([
    ["brother", "brother@example.com"],
    ["host", "host@example.com"],
  ]);
  const result = giveGuestsTheirLinkedLists(lists, [hostsList], emails);
  assert.equal(result[1].registry, null);
});

test("a guest with no email, or a list whose owner isn't a guest, changes nothing", () => {
  const lists = [guest("no-email"), guest("someone")];
  const emails = new Map<string, string | null>([
    ["no-email", null],
    ["someone", "someone@example.com"],
  ]);
  const result = giveGuestsTheirLinkedLists(lists, [hostsList, { ...hostsList, slug: "x", ownerEmail: null }], emails);
  assert.deepEqual(result, lists);
});

test("one owner's two linked lists: only the first goes on their row", () => {
  const second = { slug: "hosts-second-3c4d", title: "Host's Other List", ownerEmail: "host@example.com" };
  const result = giveGuestsTheirLinkedLists([guest("host")], [hostsList, second], new Map([["host", "host@example.com"]]));
  assert.equal(result[0].registry?.slug, "hosts-list-1a2b");
});
