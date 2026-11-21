// Run with: node --test src/lib/guest-emails.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { canEmail, emailLabel, showEmailTo } from "./guest-emails.ts";
import { newPeople } from "./groups.ts";

const HOST = "host-id";
const GLINDA = "glinda-id";
const OZ = "oz-id";

test("a typed-in guest's email shows as it always has", () => {
  const shown = showEmailTo({ name: "Nessa", email: "nessa@example.com", profile_id: null }, HOST, new Set());
  assert.deepEqual(shown, { name: "Nessa", email: "nessa@example.com" });
});

test("an email from someone the host follows both ways shows", () => {
  const shown = showEmailTo({ name: "Glinda", email: "glinda@example.com", profile_id: GLINDA }, HOST, new Set([GLINDA]));
  assert.equal(shown.email, "glinda@example.com");
  assert.equal(shown.email_hidden, false);
  assert.equal(shown.from_account, true);
});

test("an email from someone who doesn't follow the host back stays private", () => {
  const shown = showEmailTo({ name: "Oz", email: "oz@example.com", profile_id: OZ }, HOST, new Set([GLINDA]));
  assert.equal(shown.email, null);
  assert.equal(shown.email_hidden, true);
  assert.equal(shown.from_account, true);
});

test("the account id never reaches the page", () => {
  for (const mutual of [new Set<string>(), new Set([OZ])]) {
    const shown = showEmailTo({ name: "Oz", email: "oz@example.com", profile_id: OZ }, HOST, mutual);
    assert.equal("profile_id" in shown, false);
  }
});

test("a guest sees their own email, even on someone else's list", () => {
  const shown = showEmailTo({ name: "Oz", email: "oz@example.com", profile_id: OZ }, OZ, new Set());
  assert.equal(shown.email, "oz@example.com");
});

test("an account with no email isn't counted as private", () => {
  const shown = showEmailTo({ name: "Oz", email: null, profile_id: OZ }, HOST, new Set());
  assert.equal(shown.email_hidden, false);
  assert.equal(canEmail(shown), false);
  assert.equal(emailLabel(shown), "No email");
});

test("a private email can still be emailed, and says so", () => {
  const hidden = { email: null, email_hidden: true };
  assert.equal(canEmail(hidden), true);
  assert.equal(emailLabel(hidden), "Email private");
  assert.equal(emailLabel({ email: "nessa@example.com" }), "nessa@example.com");
  assert.equal(canEmail({ email: null }), false);
});

test("copying people keeps their account link, so a private email stays private", () => {
  assert.deepEqual(
    newPeople(
      [{ name: "Nessa", email: "nessa@example.com" }],
      [
        { name: "Oz", email: "OZ@example.com", profile_id: OZ },
        { name: "Nessa", email: "nessa@example.com" },
        { name: "Cy", email: null },
      ],
    ),
    [
      { name: "Oz", email: "oz@example.com", profile_id: OZ },
      { name: "Cy", email: null },
    ],
  );
});
