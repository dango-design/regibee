// Run with: node --test src/lib/guest-input.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { filledGuestRows, readGuestRows } from "./guest-input.ts";

const row = (name: string, email = "") => ({ name, email });

test("reads every filled row, trimmed, with emails in lowercase", () => {
  assert.deepEqual(readGuestRows([row(" Glinda Upland ", " Glinda@Example.com "), row("Nessa Thropp")]), {
    guests: [
      { name: "Glinda Upland", email: "glinda@example.com" },
      { name: "Nessa Thropp", email: null },
    ],
    error: null,
  });
});

test("skips rows left blank, wherever they are", () => {
  const result = readGuestRows([row(""), row("Glinda"), row("  ", " "), row("Nessa")]);
  assert.deepEqual(result.guests?.map((g) => g.name), ["Glinda", "Nessa"]);
});

test("points at a filled row without a name", () => {
  assert.deepEqual(readGuestRows([row("Glinda"), row("", "elphie@example.com")]), {
    guests: null,
    error: "Add a name for each guest.",
    row: 1,
    field: "name",
  });
  // With one row, the message is about that guest.
  assert.equal(readGuestRows([row("", "elphie@example.com")]).error, "Add the guest's name.");
});

test("points at an email that doesn't look right", () => {
  assert.deepEqual(readGuestRows([row("Glinda", "glinda@example.com"), row("Elphaba", "elphie@")]), {
    guests: null,
    error: "That email address doesn't look right.",
    row: 1,
    field: "email",
  });
});

test("asks for a name when nothing is filled in", () => {
  assert.deepEqual(readGuestRows([row(""), row(" ")]), {
    guests: null,
    error: "Add the guest's name.",
    row: 0,
    field: "name",
  });
});

test("counts the rows with something typed in them", () => {
  assert.equal(filledGuestRows([row(""), row("Glinda"), row("", "nessa@example.com"), row(" ")]), 2);
});
