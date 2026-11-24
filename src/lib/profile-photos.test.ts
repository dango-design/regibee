// Run with: node --test src/lib/profile-photos.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
const { profilePhotoFileName, profilePhotoUrl, shrinkSteps } = await import("./profile-photos.ts");

const folder = "https://example.supabase.co/storage/v1/object/public/profile-photos/k7m2p9qx4t/";
const file = "0b7e6c1e-2f43-4a7e-9d3a-6c1f0e5a9b21.jpg";

test("a photo in the profile's own folder counts", () => {
  const profile = { public_id: "k7m2p9qx4t", avatar_url: folder + file };
  assert.equal(profilePhotoUrl(profile), folder + file);
  assert.equal(profilePhotoFileName(profile), file);
});

test("no photo, or an empty one from sign-up, is none", () => {
  assert.equal(profilePhotoUrl({ public_id: "k7m2p9qx4t", avatar_url: null }), null);
  assert.equal(profilePhotoUrl({ public_id: "k7m2p9qx4t", avatar_url: "" }), null);
  assert.equal(profilePhotoUrl({ public_id: "k7m2p9qx4t" }), null);
});

test("an image from anywhere else doesn't count", () => {
  const elsewhere = [
    "https://example.com/me.jpg",
    // Someone else's folder.
    "https://example.supabase.co/storage/v1/object/public/profile-photos/a3f9c2xz7e/" + file,
    // Another bucket.
    "https://example.supabase.co/storage/v1/object/public/registry-photos/k7m2p9qx4t/" + file,
    // Another Supabase project.
    "https://other.supabase.co/storage/v1/object/public/profile-photos/k7m2p9qx4t/" + file,
    // A deeper folder, a query, another format, or a way out of the folder.
    folder + "more/" + file,
    folder + file + "?download=1",
    folder + "photo.png",
    folder + "../a3f9c2xz7e/" + file,
  ];
  for (const avatar_url of elsewhere) {
    assert.equal(profilePhotoUrl({ public_id: "k7m2p9qx4t", avatar_url }), null, avatar_url);
  }
});

test("a profile with no public id has no photo", () => {
  const url = "https://example.supabase.co/storage/v1/object/public/profile-photos//" + file;
  assert.equal(profilePhotoUrl({ public_id: "", avatar_url: url }), null);
});

test("a big photo shrinks in steps that at most halve it", () => {
  // A 48-megapixel phone photo's square, down to 320px.
  assert.deepEqual(shrinkSteps(6048, 320), [2048, 1024, 512, 320]);
  assert.deepEqual(shrinkSteps(1200, 320), [600, 320]);
  assert.deepEqual(shrinkSteps(640, 320), [320]);
  for (const side of [321, 999, 4000, 12000]) {
    const steps = shrinkSteps(side, 320);
    assert.equal(steps.at(-1), 320);
    assert.ok(steps[0] <= 2048);
    steps.slice(1).forEach((size, i) => assert.ok(size >= steps[i] / 2 - 1, `${side}: ${steps}`));
  }
});

test("a photo smaller than the target keeps its size", () => {
  assert.deepEqual(shrinkSteps(320, 320), [320]);
  assert.deepEqual(shrinkSteps(200, 320), [200]);
  assert.deepEqual(shrinkSteps(1, 320), [1]);
});
