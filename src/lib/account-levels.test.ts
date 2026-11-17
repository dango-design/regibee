// Run with: node --test src/lib/account-levels.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASIC_SITE_DAILY_EMAILS,
  BASIC_SITE_DAILY_VISITOR_EMAILS,
  DAILY_EMAILS,
  DAILY_VISITOR_EMAILS,
  noEmailsLeftMessage,
  notEnoughLeftMessage,
  partlySentMessage,
} from "./account-levels.ts";

test("star accounts can send more than basic ones", () => {
  assert.ok(DAILY_EMAILS.star > DAILY_EMAILS.basic);
});

test("basic accounts together stay under Resend's free 100 a day", () => {
  assert.ok(BASIC_SITE_DAILY_EMAILS < 100);
  assert.ok(BASIC_SITE_DAILY_EMAILS >= DAILY_EMAILS.basic);
});

test("star owners' pages can send more visitors' emails than basic owners' pages", () => {
  assert.ok(DAILY_VISITOR_EMAILS.star > DAILY_VISITOR_EMAILS.basic);
  assert.ok(BASIC_SITE_DAILY_VISITOR_EMAILS >= DAILY_VISITOR_EMAILS.basic);
});

test("basic accounts and basic owners' pages together leave room for sign-up emails", () => {
  // Resend's free plan sends 100 a day. Sign-up and password emails, and the
  // daily reminders, need the rest.
  assert.ok(BASIC_SITE_DAILY_EMAILS + BASIC_SITE_DAILY_VISITOR_EMAILS <= 90);
});

test("no message when every invitation went out", () => {
  assert.equal(partlySentMessage(12, 12), null);
});

test("a partial send says how many went and how many wait", () => {
  assert.equal(
    partlySentMessage(50, 80),
    "Sent to 50 guests. You've reached today's limit for emails, so send to the other 30 tomorrow.",
  );
  assert.match(partlySentMessage(1, 3)!, /^Sent to 1 guest\./);
});

test("nothing sent is the plain limit message", () => {
  assert.equal(partlySentMessage(0, 5), noEmailsLeftMessage());
});

test("a message or draw that doesn't fit says how many are left", () => {
  assert.equal(
    notEnoughLeftMessage(80, 20, "message"),
    "This message would email 80 people, and you can send 20 more today. Try again tomorrow.",
  );
  assert.equal(
    notEnoughLeftMessage(1, 0, "draw"),
    noEmailsLeftMessage(),
  );
  assert.equal(
    notEnoughLeftMessage(6, 4, "draw"),
    "Drawing names emails 6 people, and you can send 4 more today. Try again tomorrow.",
  );
});

test("no message talks about paying or upgrading", () => {
  const messages = [
    noEmailsLeftMessage(),
    partlySentMessage(10, 20)!,
    notEnoughLeftMessage(30, 10, "message"),
    notEnoughLeftMessage(30, 10, "draw"),
  ];
  for (const message of messages) assert.doesNotMatch(message, /upgrade|star|plan|pay/i);
});
