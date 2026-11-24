// Run with: node --test src/lib/list-access.test.ts
// Node runs TypeScript directly since version 23.6.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampProfileAudience,
  profileAudience,
  profileAudienceChoices,
  profileAudienceColumns,
  profileViewer,
  seesOnProfile,
} from "./list-access.ts";

const publicList = { is_public: true, is_private: false };
const linkList = { is_public: false, is_private: false };
const privateList = { is_public: false, is_private: true };

test("a list that isn't on the profile shows to nobody", () => {
  assert.equal(profileAudience({ ...publicList, listed_on_profile: false, profile_audience: "everyone" }), "hidden");
  assert.equal(profileAudience({ ...linkList, listed_on_profile: null }), "hidden");
});

test("a list saved before the owner could choose keeps who it showed to", () => {
  assert.equal(profileAudience({ ...publicList, listed_on_profile: true, profile_audience: null }), "everyone");
  assert.equal(profileAudience({ ...linkList, listed_on_profile: true }), "followers");
});

test("the owner's choice is used", () => {
  assert.equal(profileAudience({ ...publicList, listed_on_profile: true, profile_audience: "friends" }), "friends");
  assert.equal(profileAudience({ ...publicList, listed_on_profile: true, profile_audience: "followers" }), "followers");
  assert.equal(profileAudience({ ...linkList, listed_on_profile: true, profile_audience: "friends" }), "friends");
});

test("a link-only list never shows to everyone", () => {
  assert.equal(profileAudience({ ...linkList, listed_on_profile: true, profile_audience: "everyone" }), "followers");
  assert.equal(clampProfileAudience("everyone", "link"), "followers");
  assert.ok(!profileAudienceChoices("link").includes("everyone"));
  assert.ok(profileAudienceChoices("public").includes("everyone"));
});

test("a private list is never on a profile", () => {
  assert.equal(profileAudience({ ...privateList, listed_on_profile: true, profile_audience: "friends" }), "hidden");
  assert.deepEqual(profileAudienceChoices("private"), ["hidden"]);
  assert.deepEqual(profileAudienceColumns("friends", "private"), { listed_on_profile: false, profile_audience: null });
});

test("an unknown saved value counts as no choice", () => {
  assert.equal(profileAudience({ ...publicList, listed_on_profile: true, profile_audience: "strangers" }), "everyone");
});

test("the columns for each choice", () => {
  assert.deepEqual(profileAudienceColumns("hidden", "public"), { listed_on_profile: false, profile_audience: null });
  assert.deepEqual(profileAudienceColumns("friends", "link"), { listed_on_profile: true, profile_audience: "friends" });
  assert.deepEqual(profileAudienceColumns("everyone", "public"), { listed_on_profile: true, profile_audience: "everyone" });
  assert.deepEqual(profileAudienceColumns("everyone", "link"), { listed_on_profile: true, profile_audience: "followers" });
});

test("friends are approved followers the owner follows back", () => {
  assert.equal(profileViewer({ isOwner: true, follows: false, followedBack: false }), "owner");
  assert.equal(profileViewer({ isOwner: false, follows: true, followedBack: true }), "friend");
  assert.equal(profileViewer({ isOwner: false, follows: true, followedBack: false }), "follower");
  // The owner follows them, but they don't follow the owner: not a follower.
  assert.equal(profileViewer({ isOwner: false, follows: false, followedBack: true }), "other");
  assert.equal(profileViewer({ isOwner: false, follows: false, followedBack: false }), "other");
});

test("each audience includes the ones before it", () => {
  const seen = (audience: Parameters<typeof seesOnProfile>[0]) =>
    (["owner", "friend", "follower", "other"] as const).filter((viewer) => seesOnProfile(audience, viewer));
  assert.deepEqual(seen("hidden"), []);
  assert.deepEqual(seen("friends"), ["owner", "friend"]);
  assert.deepEqual(seen("followers"), ["owner", "friend", "follower"]);
  assert.deepEqual(seen("everyone"), ["owner", "friend", "follower", "other"]);
});
