import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eventIdsBothInvited,
  eventParts,
  goes,
  invited,
  sharedEventIds,
  sortSharedEvents,
  type PartGuestRow,
} from "./shared-events.ts";

const guest = (event_id: string, rsvp_status: PartGuestRow["rsvp_status"], token = `t-${event_id}`): PartGuestRow => ({
  event_id,
  rsvp_status,
  token,
});

test("only a host or a guest who said yes goes", () => {
  assert.equal(goes("host"), true);
  assert.equal(goes("yes"), true);
  assert.equal(goes("maybe"), false);
  assert.equal(goes("no"), false);
  assert.equal(goes("pending"), false);
  assert.equal(goes(undefined), false);
});

test("hosting wins over a guest row on the same event", () => {
  const { parts, tokens } = eventParts(["a"], [guest("a", "no"), guest("b", "yes")]);
  assert.equal(parts.get("a"), "host");
  assert.equal(parts.get("b"), "yes");
  assert.equal(tokens.get("b"), "t-b");
});

test("the first guest row for an event wins", () => {
  const { parts, tokens } = eventParts([], [guest("a", "yes", "account"), guest("a", "no", "email")]);
  assert.equal(parts.get("a"), "yes");
  assert.equal(tokens.get("a"), "account");
});

test("an event is shared only when both go", () => {
  const viewer = eventParts(["hosted"], [guest("both", "yes"), guest("declined", "no"), guest("mine", "yes")]);
  const person = eventParts(
    [],
    [guest("hosted", "yes"), guest("both", "yes"), guest("declined", "yes"), guest("theirs", "yes")],
  );
  assert.deepEqual(sharedEventIds(viewer, person).sort(), ["both", "hosted"]);
});

test("an invitation with no reply, or a maybe, isn't shared", () => {
  const viewer = eventParts([], [guest("a", "yes"), guest("b", "yes")]);
  const person = eventParts([], [guest("a", "pending"), guest("b", "maybe")]);
  assert.deepEqual(sharedEventIds(viewer, person), []);
});

test("co-hosts share their event", () => {
  assert.deepEqual(sharedEventIds(eventParts(["a"], []), eventParts(["a"], [])), ["a"]);
});

test("upcoming events come soonest first, then undated, then past most recent first", () => {
  const events = ["2026-01-05", null, "2026-12-25", "2026-11-24", "2026-06-01"].map((eventDate) => ({ eventDate }));
  assert.deepEqual(
    sortSharedEvents(events, "2026-11-24").map((event) => event.eventDate),
    ["2026-11-24", "2026-12-25", null, "2026-06-01", "2026-01-05"],
  );
});

test("anyone on an event who hasn't said no is invited", () => {
  assert.equal(invited("host"), true);
  assert.equal(invited("yes"), true);
  assert.equal(invited("maybe"), true);
  assert.equal(invited("pending"), true);
  assert.equal(invited("no"), false);
  assert.equal(invited(undefined), false);
});

test("a list's events show only where both people are invited and neither said no", () => {
  const viewer = eventParts(["hosted"], [guest("both", "pending"), guest("owner-declined", "yes"), guest("viewer-declined", "no")]);
  const owner = eventParts([], [
    guest("hosted", "maybe"),
    guest("both", "yes"),
    guest("owner-declined", "no"),
    guest("viewer-declined", "yes"),
    guest("owner-only", "yes"),
  ]);
  const ids = ["hosted", "both", "owner-declined", "viewer-declined", "owner-only", "both"];
  assert.deepEqual(eventIdsBothInvited(ids, viewer, owner), ["hosted", "both"]);
});
