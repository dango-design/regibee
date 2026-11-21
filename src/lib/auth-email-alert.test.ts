// Run with: node --test src/lib/auth-email-alert.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authEmailAlert,
  authEmailAlertKind,
  authEmailHourlyLimit,
  authEmailWarnAt,
  supabaseRateLimitsUrl,
} from "./auth-email-alert.ts";

test("the limit is Supabase's 30 unless AUTH_EMAIL_HOURLY_LIMIT gives a whole number above 0", () => {
  assert.equal(authEmailHourlyLimit(undefined), 30);
  assert.equal(authEmailHourlyLimit(""), 30);
  assert.equal(authEmailHourlyLimit("  "), 30);
  assert.equal(authEmailHourlyLimit("abc"), 30);
  assert.equal(authEmailHourlyLimit("0"), 30);
  assert.equal(authEmailHourlyLimit("-5"), 30);
  assert.equal(authEmailHourlyLimit("12.5"), 30);
  assert.equal(authEmailHourlyLimit("100"), 100);
  assert.equal(authEmailHourlyLimit(" 60 "), 60);
});

test("the warning comes at two thirds of the limit", () => {
  assert.equal(authEmailWarnAt(30), 20);
  assert.equal(authEmailWarnAt(100), 66);
  assert.equal(authEmailWarnAt(2), 1);
  assert.equal(authEmailWarnAt(1), 1);
});

test("below the warning, nothing is sent; then a warning; at the limit, the limit email", () => {
  assert.equal(authEmailAlertKind(0, 30), null);
  assert.equal(authEmailAlertKind(19, 30), null);
  assert.equal(authEmailAlertKind(20, 30), "auth-emails-warning");
  assert.equal(authEmailAlertKind(29, 30), "auth-emails-warning");
  assert.equal(authEmailAlertKind(30, 30), "auth-emails-limit");
  // Supabase's limit may have been raised before AUTH_EMAIL_HOURLY_LIMIT was.
  assert.equal(authEmailAlertKind(45, 30), "auth-emails-limit");
  assert.equal(authEmailAlertKind(1, 1), "auth-emails-limit");
});

test("the Rate Limits link is built only for a hosted Supabase project", () => {
  assert.equal(
    supabaseRateLimitsUrl("https://abcdefgh.supabase.co"),
    "https://supabase.com/dashboard/project/abcdefgh/auth/rate-limits"
  );
  assert.equal(
    supabaseRateLimitsUrl("https://abcdefgh.supabase.co/"),
    "https://supabase.com/dashboard/project/abcdefgh/auth/rate-limits"
  );
  assert.equal(supabaseRateLimitsUrl("http://127.0.0.1:54321"), null);
  assert.equal(supabaseRateLimitsUrl("https://abcdefgh.supabase.co.example.com"), null);
  assert.equal(supabaseRateLimitsUrl(undefined), null);
});

test("the warning says how many are left and how to raise the limit", () => {
  const { subject, html } = authEmailAlert({
    kind: "auth-emails-warning",
    emails: 21,
    limit: 30,
    rateLimitsUrl: "https://supabase.com/dashboard/project/abcdefgh/auth/rate-limits",
  });
  assert.equal(subject, "Regibee has sent 21 of its 30 account emails this hour");
  assert.match(html, /sent 21 of the 30 account emails/);
  assert.match(html, /href="https:\/\/supabase\.com\/dashboard\/project\/abcdefgh\/auth\/rate-limits"/);
  assert.match(html, /AUTH_EMAIL_HOURLY_LIMIT/);
  assert.match(html, /Resend/);
});

test("the limit email says sign-ups are failing now", () => {
  const { subject, html } = authEmailAlert({ kind: "auth-emails-limit", emails: 30, limit: 30, rateLimitsUrl: null });
  assert.equal(subject, "Regibee reached its limit of 30 account emails an hour");
  assert.match(html, /new sign-ups and password resets fail, on the website and in the phone app/);
  assert.doesNotMatch(html, /href=/);
});
