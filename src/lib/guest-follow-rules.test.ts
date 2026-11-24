import assert from "node:assert/strict";
import { test } from "node:test";
import { guestFollow, type GuestAccount } from "./guest-follow-rules.ts";

const account = (changes: Partial<GuestAccount> = {}): GuestAccount => ({
  publicId: "abcdefghjk",
  discoverable: false,
  findableByEmail: false,
  status: null,
  followsYou: false,
  blocked: false,
  ...changes,
});

test("a host who sees the guest's email follows the account's email choice", () => {
  assert.equal(guestFollow(account({ discoverable: true }), "email"), null);
  assert.deepEqual(guestFollow(account({ findableByEmail: true }), "email"), {
    publicId: "abcdefghjk",
    state: "none",
    followsYou: false,
  });
});

test("someone who sees only the guest's name follows the people-search choice", () => {
  assert.equal(guestFollow(account({ findableByEmail: true }), "name"), null);
  assert.equal(guestFollow(account({ discoverable: true }), "name")?.state, "none");
});

test("people who already follow or asked see where it stands", () => {
  assert.equal(guestFollow(account({ status: "pending" }), "name")?.state, "pending");
  assert.equal(guestFollow(account({ status: "approved" }), "email")?.state, "approved");
  assert.deepEqual(guestFollow(account({ followsYou: true }), "name"), {
    publicId: "abcdefghjk",
    state: "none",
    followsYou: true,
  });
});

test("a block either way shows nothing", () => {
  assert.equal(
    guestFollow(account({ blocked: true, discoverable: true, findableByEmail: true, status: "approved" }), "email"),
    null,
  );
});
