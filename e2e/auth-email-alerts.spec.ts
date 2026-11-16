// The warning before Supabase's hourly limit on account emails is reached. A
// pg_cron job calls /api/cron/auth-emails every 5 minutes; here the test calls
// it. The tests' site sets the limit to 1 (playwright.config.ts), so one
// sign-up is enough to reach it.

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ALERT_EMAIL, CRON_SECRET, db, uniqueEmail } from "./fixtures";
import { emailsTo } from "./mailbox";
import { localSupabase } from "./local-supabase";

const anonClient = () =>
  createClient(localSupabase().apiUrl, localSupabase().anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function emailsInLastHour(): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await db.rpc("auth_emails_sent_since", { p_since: since });
  if (error) throw error;
  return data as number;
}

test("a sign-up's confirmation email counts, and reaching the limit emails ALERT_EMAIL once", async ({ request }) => {
  // Only the pg_cron job, with CRON_SECRET, can run the check.
  expect((await request.get("/api/cron/auth-emails")).status()).toBe(401);

  // A sign-up sends a confirmation email, and the count includes it.
  const before = await emailsInLastHour();
  const { error: signUpError } = await anonClient().auth.signUp({
    email: uniqueEmail("limit"),
    password: "a-long-test-password",
  });
  expect(signUpError).toBeNull();
  expect(await emailsInLastHour()).toBeGreaterThanOrEqual(before + 1);

  // Forget warnings from earlier runs, so this one isn't held back.
  const { error: clearError } = await db.from("site_alerts").delete().gte("id", 0);
  expect(clearError).toBeNull();
  const newestAlert = async () => (await emailsTo(ALERT_EMAIL))[0];
  const earlierAlert = await newestAlert();

  const check = () =>
    request.get("/api/cron/auth-emails", { headers: { authorization: `Bearer ${CRON_SECRET}` } });

  const first = await check();
  expect(first.ok()).toBe(true);
  const result = await first.json();
  expect(result).toMatchObject({ limit: 1, warnAt: 1, alert: "auth-emails-limit", sent: true });
  expect(result.emails).toBeGreaterThanOrEqual(1);

  // The route sends before it answers, so the email is there already.
  const alert = await newestAlert();
  expect(alert?.id).not.toBe(earlierAlert?.id);
  expect(alert.subject).toBe("Regibee reached its limit of 1 account emails an hour");
  expect(alert.html).toContain("AUTH_EMAIL_HOURLY_LIMIT");

  // On the next run the count is still at the limit, but the email went out
  // within the hour, so it isn't sent again.
  const second = await check();
  expect(await second.json()).toMatchObject({ alert: "auth-emails-limit", sent: false });
  expect((await newestAlert()).id).toBe(alert.id);
});

test("the browser's key can't count account emails or read the warnings", async () => {
  const anon = anonClient();
  const { error: countError } = await anon.rpc("auth_emails_sent_since", { p_since: new Date(0).toISOString() });
  expect(countError).not.toBeNull();

  const { data: alerts, error: alertsError } = await anon.from("site_alerts").select("id");
  // Revoked, so Supabase refuses rather than returning no rows.
  expect(alerts ?? []).toEqual([]);
  expect(alertsError).not.toBeNull();
});
