// Run with: node --test src/lib/analytics-urls.test.ts
//
// Cleaning addresses before they go to PostHog (src/lib/analytics-urls.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import { isUntrackedPath, scrubEventProperties, scrubPath, scrubReferrer, scrubUrl } from "./analytics-urls.ts";

const ID = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";

test("hides list and event slugs", () => {
  assert.equal(scrubPath("/r/baby-shower-k3j9x2m1q8zt"), "/r/:slug");
  assert.equal(scrubPath("/e/birthday-k3j9x2m1q8zt"), "/e/:slug");
  assert.equal(scrubPath("/r/baby-shower-k3j9x2m1q8zt/"), "/r/:slug/");
});

test("hides a gift's id on a list", () => {
  assert.equal(scrubPath(`/r/baby-shower-k3j9x2m1q8zt/gift/${ID}`), "/r/:slug/gift/:id");
  assert.equal(scrubPath("/r/baby-shower-k3j9x2m1q8zt/gift/12345"), "/r/:slug/gift/:id");
});

test("hides profile names", () => {
  assert.equal(scrubPath("/u/someone"), "/u/:profile");
});

test("hides every kind of invite token", () => {
  for (const page of ["invite", "group-gift", "host-invite", "follow-invite", "list-request"]) {
    assert.equal(scrubPath(`/${page}/abcDEF123456`), `/${page}/:token`);
  }
});

test("hides the demo pages' slugs the same way", () => {
  assert.equal(scrubPath("/demo/r/sample-list"), "/demo/r/:slug");
  assert.equal(scrubPath("/demo/group-gift/sample"), "/demo/group-gift/:token");
});

test("hides ids anywhere in a path", () => {
  assert.equal(scrubPath(`/dashboard/registry/${ID}`), "/dashboard/registry/:id");
  assert.equal(scrubPath(`/dashboard/events/${ID.toUpperCase()}`), "/dashboard/events/:id");
  // Phone app screens.
  assert.equal(scrubPath(`/item/${ID}`), "/item/:id");
  assert.equal(scrubPath(`/registry/${ID}/settings`), "/registry/:id/settings");
});

test("drops the query string and hash", () => {
  assert.equal(scrubPath("/dashboard?next=/r/secret-k3j9x2m1q8zt#top"), "/dashboard");
  assert.equal(scrubPath("/login?email=someone@example.com"), "/login");
});

test("leaves plain pages alone", () => {
  assert.equal(scrubPath("/"), "/");
  assert.equal(scrubPath("/dashboard/saved"), "/dashboard/saved");
  assert.equal(scrubPath("/privacy"), "/privacy");
  // "r" is only a list link as the first segment.
  assert.equal(scrubPath("/dashboard/r/thing"), "/dashboard/r/thing");
});

test("cleans full addresses", () => {
  assert.equal(scrubUrl("https://regibee.com/r/baby-shower-k3j9x2m1q8zt?ref=email"), "https://regibee.com/r/:slug");
  assert.equal(scrubUrl("not an address"), "");
});

test("keeps only the origin of another site's referrer", () => {
  const own = "https://regibee.com";
  assert.equal(scrubReferrer("https://mail.google.com/mail/u/0/#inbox/abc123", own), "https://mail.google.com");
  assert.equal(scrubReferrer("https://regibee.com/r/baby-shower-k3j9x2m1q8zt", own), "https://regibee.com/r/:slug");
  assert.equal(scrubReferrer("$direct", own), "$direct");
  assert.equal(scrubReferrer("", own), "");
});

test("never tracks gift ideas or support pages", () => {
  assert.equal(isUntrackedPath("/dashboard/saved/ideas"), true);
  assert.equal(isUntrackedPath("/dashboard/saved/ideas?x=1"), true);
  assert.equal(isUntrackedPath("/support"), true);
  assert.equal(isUntrackedPath(`/support/users/${ID}`), true);
  assert.equal(isUntrackedPath("/idea"), true);
  assert.equal(isUntrackedPath("/dashboard/saved"), false);
  assert.equal(isUntrackedPath("/supporters"), false);
});

test("cleans every address property PostHog's browser library sets", () => {
  const clean = scrubEventProperties(
    {
      $current_url: "https://regibee.com/r/baby-shower-k3j9x2m1q8zt?x=1",
      $initial_current_url: "https://regibee.com/invite/abcDEF123456",
      $prev_pageview_url: `https://regibee.com/dashboard/registry/${ID}`,
      $pathname: "/r/baby-shower-k3j9x2m1q8zt",
      $initial_pathname: "/invite/abcDEF123456",
      $prev_pageview_pathname: `/dashboard/registry/${ID}`,
      $referrer: "https://mail.google.com/mail/u/0/#inbox/abc",
      $initial_referrer: "https://regibee.com/e/party-k3j9x2m1q8zt",
      $browser: "Chrome",
      title: "Sam's baby registry",
      $set_once: { $initial_current_url: "https://regibee.com/u/someone?x=1" },
    },
    "https://regibee.com",
  );
  assert.deepEqual(clean, {
    $current_url: "https://regibee.com/r/:slug",
    $initial_current_url: "https://regibee.com/invite/:token",
    $prev_pageview_url: "https://regibee.com/dashboard/registry/:id",
    $pathname: "/r/:slug",
    $initial_pathname: "/invite/:token",
    $prev_pageview_pathname: "/dashboard/registry/:id",
    $referrer: "https://mail.google.com",
    $initial_referrer: "https://regibee.com/e/:slug",
    $browser: "Chrome",
    $set_once: { $initial_current_url: "https://regibee.com/u/:profile" },
  });
});

test("leaves out any property that points at a gift idea or support page", () => {
  const clean = scrubEventProperties(
    {
      $current_url: "https://regibee.com/dashboard",
      $prev_pageview_pathname: "/dashboard/saved/ideas",
      $prev_pageview_url: `https://regibee.com/support/users/${ID}`,
      $referrer: "https://regibee.com/dashboard/saved/ideas?x=1",
      $prev_pageview_duration: 12,
    },
    "https://regibee.com",
  );
  assert.deepEqual(clean, {
    $current_url: "https://regibee.com/dashboard",
    $prev_pageview_duration: 12,
  });
});

test("cleans address properties it hasn't seen before, by their names", () => {
  const clean = scrubEventProperties(
    {
      $session_entry_url: "https://regibee.com/r/baby-shower-k3j9x2m1q8zt",
      $session_entry_referrer: "https://mail.google.com/mail/u/0/#inbox/abc",
      $session_entry_pathname: "/invite/abcDEF123456",
      $referring_domain: "mail.google.com",
      count: 3,
    },
    "https://regibee.com",
  );
  assert.deepEqual(clean, {
    $session_entry_url: "https://regibee.com/r/:slug",
    $session_entry_referrer: "https://mail.google.com",
    $session_entry_pathname: "/invite/:token",
    $referring_domain: "mail.google.com",
    count: 3,
  });
});
