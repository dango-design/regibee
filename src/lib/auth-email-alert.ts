// Warns whoever runs the site before Supabase's hourly limit on account emails
// is reached. Supabase sends the emails that confirm a new account and reset a
// password, and sends at most a set number an hour for the whole project.
// Past that, sign-ups and password resets fail on the website and in the
// phone app until the hour is up, and Supabase tells no one.
//
// A pg_cron job calls /api/cron/auth-emails every 5 minutes, which counts the
// emails sent in the last hour and emails ALERT_EMAIL. This file decides when
// and what to send. It imports only the emails' font, so its tests run
// without the server.

import { withEmailFont } from "./email-font.ts";

/** Supabase's limit for a new project with its own SMTP server. */
export const DEFAULT_AUTH_EMAIL_HOURLY_LIMIT = 30;

export type AuthEmailAlertKind = "auth-emails-warning" | "auth-emails-limit";

/**
 * The limit set under Authentication → Rate Limits in Supabase. The site can't
 * read it, so AUTH_EMAIL_HOURLY_LIMIT copies it, and is 30 when unset.
 */
export function authEmailHourlyLimit(value: string | undefined): number {
  const limit = Number(value?.trim() || NaN);
  return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_AUTH_EMAIL_HOURLY_LIMIT;
}

/** The count that brings a warning: two thirds of the limit, so 20 of 30. */
export function authEmailWarnAt(limit: number): number {
  return Math.max(1, Math.floor((limit * 2) / 3));
}

/** Which email this count calls for, if any. */
export function authEmailAlertKind(emails: number, limit: number): AuthEmailAlertKind | null {
  if (emails >= limit) return "auth-emails-limit";
  if (emails >= authEmailWarnAt(limit)) return "auth-emails-warning";
  return null;
}

/**
 * The Rate Limits page in Supabase's dashboard, for the project at this API
 * address (https://<ref>.supabase.co). Null for any other address, such as
 * local Supabase.
 */
export function supabaseRateLimitsUrl(apiUrl: string | undefined): string | null {
  const match = apiUrl?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/);
  return match ? `https://supabase.com/dashboard/project/${match[1]}/auth/rate-limits` : null;
}

export function authEmailAlert(opts: {
  kind: AuthEmailAlertKind;
  emails: number;
  limit: number;
  rateLimitsUrl: string | null;
}): { subject: string; html: string } {
  const { kind, emails, limit, rateLimitsUrl } = opts;
  const rateLimits = rateLimitsUrl
    ? `<a href="${rateLimitsUrl}">Authentication → Rate Limits</a>`
    : "Authentication → Rate Limits";

  const opening =
    kind === "auth-emails-limit"
      ? `<p>Supabase has sent all ${limit} of the account emails it allows in an hour. Until some of them are an hour old, new sign-ups and password resets fail, on the website and in the phone app.</p>`
      : `<p>Supabase has sent ${emails} of the ${limit} account emails it allows in an hour. Once it reaches ${limit}, new sign-ups and password resets fail until some of them are an hour old.</p>`;

  const html = withEmailFont([
    opening,
    `<p>Account emails are the ones that confirm a new account's email address and reset a password.</p>`,
    `<p>To allow more, raise "Rate limit for sending emails" under ${rateLimits} in Supabase. ` +
      `Check first that Resend's plan can send that many. ` +
      `Then set AUTH_EMAIL_HOURLY_LIMIT in Vercel to the new number and redeploy, so these warnings use it.</p>`,
    `<p>This email comes at most once an hour.</p>`,
  ].join("\n"));

  const subject =
    kind === "auth-emails-limit"
      ? `Regibee reached its limit of ${limit} account emails an hour`
      : `Regibee has sent ${emails} of its ${limit} account emails this hour`;

  return { subject, html };
}
