// Run with: node --test src/lib/gift-ideas.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupByRecipient,
  groupHeading,
  groupName,
  parseGiftIdea,
  recentRecipients,
  recipientKey,
  type GiftIdea,
} from "./gift-ideas.ts";

function idea(id: string, recipient: string, createdAt: string, boughtAt: string | null = null): GiftIdea {
  return {
    id,
    recipient,
    title: `Idea ${id}`,
    externalUrl: null,
    imageUrl: null,
    price: null,
    notes: null,
    boughtAt,
    createdAt,
  };
}

test("an idea needs a name", () => {
  assert.deepEqual(parseGiftIdea({ recipient: "Mom" }), { error: "Give the idea a name." });
  assert.deepEqual(parseGiftIdea({ recipient: "Mom", title: "   " }), { error: "Give the idea a name." });
  assert.deepEqual(parseGiftIdea(null), { error: "Give the idea a name." });
});

test("who it's for can be left out", () => {
  const empty = { recipient: "", title: "Scarf", external_url: null, image_url: null, price: null, notes: null };
  assert.deepEqual(parseGiftIdea({ title: "Scarf" }), { fields: empty });
  assert.deepEqual(parseGiftIdea({ recipient: "  ", title: "Scarf" }), { fields: empty });
  assert.deepEqual(parseGiftIdea({ recipient: null, title: "Scarf" }), { fields: empty });
});

test("an idea is cleaned up before it's saved", () => {
  const result = parseGiftIdea({
    recipient: "  Mom  ",
    title: "Wool   scarf\n in green",
    url: "www.example.com/scarf",
    imageUrl: "https://img.example.com/scarf.jpg",
    price: "$1,299.999",
    notes: "  She liked the green one.  ",
  });
  assert.deepEqual(result, {
    fields: {
      recipient: "Mom",
      title: "Wool scarf in green",
      external_url: "https://www.example.com/scarf",
      image_url: "https://img.example.com/scarf.jpg",
      price: 1300,
      notes: "She liked the green one.",
    },
  });
});

test("the link, picture, price and note are optional", () => {
  assert.deepEqual(parseGiftIdea({ recipient: "Dad", title: "Socks", url: "", price: "", notes: "" }), {
    fields: { recipient: "Dad", title: "Socks", external_url: null, image_url: null, price: null, notes: null },
  });
  assert.equal(parseGiftIdea({ recipient: "Dad", title: "Socks", price: 0 }).fields?.price, 0);
});

test("a bad link or price is an error, a bad picture is dropped", () => {
  assert.match(parseGiftIdea({ recipient: "Dad", title: "Socks", url: "javascript:alert(1)" }).error ?? "", /link/);
  assert.match(parseGiftIdea({ recipient: "Dad", title: "Socks", url: "not a link" }).error ?? "", /link/);
  assert.match(parseGiftIdea({ recipient: "Dad", title: "Socks", price: "about 20" }).error ?? "", /price/);
  assert.match(parseGiftIdea({ recipient: "Dad", title: "Socks", price: -5 }).error ?? "", /price/);
  assert.equal(parseGiftIdea({ recipient: "Dad", title: "Socks", imageUrl: "data:image/png;base64,AAAA" }).fields?.image_url, null);
});

test("long text is refused", () => {
  assert.match(parseGiftIdea({ recipient: "x".repeat(81), title: "Socks" }).error ?? "", /80/);
  assert.match(parseGiftIdea({ recipient: "Dad", title: "x".repeat(301) }).error ?? "", /300/);
  assert.match(parseGiftIdea({ recipient: "Dad", title: "Socks", notes: "x".repeat(1001) }).error ?? "", /1000/);
});

test("names match without case or extra spaces", () => {
  assert.equal(recipientKey("  Aunt   Jo "), "aunt jo");
  assert.equal(recipientKey("MOM"), recipientKey("mom"));
});

test("ideas group by person, newest person first", () => {
  const groups = groupByRecipient([
    idea("1", "Mom", "2026-11-01T10:00:00Z"),
    idea("2", "Dad", "2026-11-03T10:00:00Z"),
    idea("3", "mom", "2026-11-05T10:00:00Z"),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.name, g.ideas.map((i) => i.id)]),
    [
      ["mom", ["3", "1"]],
      ["Dad", ["2"]],
    ],
  );
});

test("ideas saved without a person come last, in one group", () => {
  const groups = groupByRecipient([
    idea("1", "", "2026-11-06T10:00:00Z"),
    idea("2", "Mom", "2026-11-01T10:00:00Z"),
    idea("3", " ", "2026-11-04T10:00:00Z"),
    idea("4", "Dad", "2026-11-03T10:00:00Z"),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.key, g.ideas.map((i) => i.id)]),
    [
      ["dad", ["4"]],
      ["mom", ["2"]],
      ["", ["1", "3"]],
    ],
  );
  assert.deepEqual(groups.map(groupHeading), ["For Dad", "For Mom", "Not sure who yet"]);
  assert.deepEqual(groups.map(groupName), ["Dad", "Mom", "Not sure who yet"]);
});

test("bought ideas go after the ones still to decide on", () => {
  const [group] = groupByRecipient([
    idea("1", "Mom", "2026-11-01T10:00:00Z", "2026-11-10T10:00:00Z"),
    idea("2", "Mom", "2026-11-02T10:00:00Z"),
    idea("3", "Mom", "2026-11-03T10:00:00Z", "2026-11-04T10:00:00Z"),
    idea("4", "Mom", "2026-11-04T10:00:00Z"),
  ]);
  assert.deepEqual(
    group.ideas.map((i) => i.id),
    ["4", "2", "1", "3"],
  );
  assert.equal(group.openCount, 2);
});

test("suggested names are one per person, most recent first", () => {
  const names = recentRecipients([
    idea("1", "Mom", "2026-11-01T10:00:00Z"),
    idea("2", "Dad", "2026-11-03T10:00:00Z"),
    idea("3", "mom ", "2026-11-05T10:00:00Z"),
    idea("4", "Sam", "2026-11-02T10:00:00Z"),
  ]);
  assert.deepEqual(names, ["mom", "Dad", "Sam"]);
  // An idea saved without a person isn't a name to suggest.
  assert.deepEqual(recentRecipients([idea("1", "Mom", "1"), idea("2", "", "2")]), ["Mom"]);
  assert.deepEqual(recentRecipients([idea("1", "A", "1"), idea("2", "B", "2")], 1), ["B"]);
});
