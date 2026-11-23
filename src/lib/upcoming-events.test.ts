// Run with: node --test src/lib/upcoming-events.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import { countdownLabel, daysUntil } from "./occasions.ts";
import { UPCOMING_EVENTS_LIMIT, pickUpcomingEvents, type UpcomingEventCandidate } from "./upcoming-events.ts";

const TODAY = "2026-11-20";

function event(id: string, eventDate: string | null, overrides: Partial<UpcomingEventCandidate> = {}): UpcomingEventCandidate {
  return {
    id,
    slug: `${id}-slug`,
    title: id,
    eventType: "birthday",
    eventDate,
    time: null,
    role: "host",
    summary: { guests: 0, attending: 0, maybe: 0, pending: 0 },
    ...overrides,
  };
}

test("daysUntil counts whole days between two dates", () => {
  assert.equal(daysUntil("2026-11-20", TODAY), 0);
  assert.equal(daysUntil("2026-11-21", TODAY), 1);
  assert.equal(daysUntil("2026-12-25", TODAY), 35);
  assert.equal(daysUntil("2026-11-19", TODAY), -1);
  // Across the end of daylight saving time and a new year.
  assert.equal(daysUntil("2027-03-15", "2026-10-30"), 136);
});

test("countdownLabel still words the countdown the same way", () => {
  assert.equal(countdownLabel("2026-11-20", TODAY, "personal"), "Today");
  assert.equal(countdownLabel("2026-11-21", TODAY, "personal"), "Tomorrow");
  assert.equal(countdownLabel("2026-12-02", TODAY, "personal"), "12 days to go");
  assert.equal(countdownLabel("2026-11-19", TODAY, "personal"), "Nov 19, 2026");
  assert.equal(countdownLabel("2026-12-02", TODAY, "baby"), "Due in 12 days");
});

test("pickUpcomingEvents keeps today's and later events, soonest first", () => {
  const picked = pickUpcomingEvents(
    [
      event("christmas", "2026-12-25"),
      event("yesterday", "2026-11-19"),
      event("today", "2026-11-20"),
      event("next-week", "2026-11-27"),
    ],
    TODAY,
  );
  assert.deepEqual(
    picked.map((e) => e.id),
    ["today", "next-week", "christmas"],
  );
});

test("pickUpcomingEvents leaves out events with no date", () => {
  const picked = pickUpcomingEvents([event("someday", null), event("soon", "2026-11-22")], TODAY);
  assert.deepEqual(
    picked.map((e) => e.id),
    ["soon"],
  );
});

test("pickUpcomingEvents shows at most three by default", () => {
  const picked = pickUpcomingEvents(
    ["2026-11-24", "2026-11-21", "2026-11-23", "2026-11-22", "2026-11-25"].map((date) => event(date, date)),
    TODAY,
  );
  assert.equal(UPCOMING_EVENTS_LIMIT, 3);
  assert.deepEqual(
    picked.map((e) => e.id),
    ["2026-11-21", "2026-11-22", "2026-11-23"],
  );
});

test("pickUpcomingEvents mixes hosted and celebrating events by date", () => {
  const picked = pickUpcomingEvents(
    [
      event("dinner", "2026-12-05"),
      event("shower", "2026-11-29", { role: "celebrating", summary: null }),
    ],
    TODAY,
  );
  assert.deepEqual(
    picked.map((e) => [e.id, e.role]),
    [
      ["shower", "celebrating"],
      ["dinner", "host"],
    ],
  );
});

test("pickUpcomingEvents keeps the first entry for an event listed twice", () => {
  const picked = pickUpcomingEvents(
    [event("party", "2026-12-01"), event("party", "2026-12-01", { role: "celebrating", summary: null })],
    TODAY,
  );
  assert.equal(picked.length, 1);
  assert.equal(picked[0].role, "host");
});

test("an event you're invited to that also celebrates you shows as an invitation", () => {
  // The dashboard passes hosted events, then invitations, then celebrating ones.
  const picked = pickUpcomingEvents(
    [
      event("shower", "2026-12-01", { role: "guest", summary: null, rsvp: "pending", guestToken: "t" }),
      event("shower", "2026-12-01", { role: "celebrating", summary: null }),
    ],
    TODAY,
  );
  assert.equal(picked.length, 1);
  assert.equal(picked[0].role, "guest");
  assert.equal(picked[0].rsvp, "pending");
});

test("pickUpcomingEvents sorts events on the same day by title", () => {
  const picked = pickUpcomingEvents(
    [event("b", "2026-12-01", { title: "Brunch" }), event("a", "2026-12-01", { title: "Afternoon tea" })],
    TODAY,
  );
  assert.deepEqual(
    picked.map((e) => e.title),
    ["Afternoon tea", "Brunch"],
  );
});
