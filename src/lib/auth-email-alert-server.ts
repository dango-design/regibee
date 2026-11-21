import { supabaseAdmin } from "./supabase-admin";
import { sendEmail } from "./mailer";
import {
  authEmailAlert,
  authEmailAlertKind,
  authEmailHourlyLimit,
  authEmailWarnAt,
  supabaseRateLimitsUrl,
  type AuthEmailAlertKind,
} from "./auth-email-alert";

const FROM = "Regibee <notifications@regibee.com>";
const HOUR_MS = 60 * 60 * 1000;

/**
 * Logs an alert before it's sent, and returns the log's id. Null when one of
 * this kind went out within the hour, so it isn't sent again.
 */
async function claim(kind: AuthEmailAlertKind, since: string): Promise<number | null> {
  const { data: recent, error } = await supabaseAdmin
    .from("site_alerts")
    .select("id")
    .eq("kind", kind)
    .gte("sent_at", since)
    .limit(1);
  if (error) throw new Error(`Couldn't read site_alerts: ${error.message}`);
  if (recent.length > 0) return null;

  const { data: row, error: insertError } = await supabaseAdmin
    .from("site_alerts")
    .insert({ kind })
    .select("id")
    .single();
  if (insertError) throw new Error(`Couldn't log the alert: ${insertError.message}`);
  return row.id;
}

/**
 * Run every 5 minutes by /api/cron/auth-emails. Counts the account emails
 * Supabase sent in the last hour, and emails ALERT_EMAIL when the count nears
 * or reaches the limit, at most once an hour for each.
 */
export async function checkAuthEmails(now = new Date()) {
  const limit = authEmailHourlyLimit(process.env.AUTH_EMAIL_HOURLY_LIMIT);
  const since = new Date(now.getTime() - HOUR_MS).toISOString();

  const { data: emails, error } = await supabaseAdmin.rpc("auth_emails_sent_since", { p_since: since });
  if (error) throw new Error(`Couldn't count account emails: ${error.message}`);

  const kind = authEmailAlertKind(emails, limit);
  const result = { emails: emails as number, limit, warnAt: authEmailWarnAt(limit), alert: kind, sent: false };
  if (!kind) return result;

  const to = process.env.ALERT_EMAIL;
  if (!to) {
    console.warn(`[auth-emails] ${emails} of ${limit} account emails sent this hour, and ALERT_EMAIL isn't set`);
    return result;
  }

  const id = await claim(kind, since);
  if (id === null) return result;

  try {
    await sendEmail({
      from: FROM,
      to,
      ...authEmailAlert({
        kind,
        emails,
        limit,
        rateLimitsUrl: supabaseRateLimitsUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
      }),
    });
  } catch (sendError) {
    // Not sent, so the next run tries again.
    await supabaseAdmin.from("site_alerts").delete().eq("id", id);
    throw sendError;
  }
  return { ...result, sent: true };
}
