import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  BASIC_SITE_DAILY_EMAILS,
  BASIC_SITE_DAILY_VISITOR_EMAILS,
  DAILY_EMAILS,
  DAILY_VISITOR_EMAILS,
  EMAILS_UNAVAILABLE,
  noEmailsLeftMessage,
  type EmailKind,
  type VisitorEmailKind,
} from "@/lib/account-levels";

// Server only. Every email to an address someone typed in goes through here
// first, so one account, or many new ones, can't send a flood of them. So
// does every email a visitor sets off on a list, event or group gift. The
// limits are in account-levels.ts. The database does the counting
// (reserve_emails in 20261116074752_account_levels.sql and
// reserve_visitor_emails in 20261117085323_visitor_email_limits.sql), so two
// sends at once can't both take the last of the allowance.

export interface EmailReservation {
  /** The email_sends row, or null when nothing was taken. */
  id: number | null;
  /** How many emails this send may go to. */
  granted: number;
  /** How many the account could send before this, for messages. */
  left: number;
  /** True when the limit couldn't be checked, so nothing may be sent. */
  failed: boolean;
}

const NOTHING: EmailReservation = { id: null, granted: 0, left: 0, failed: false };

/**
 * Takes up to `wanted` emails from the account's allowance for the last 24
 * hours. With `allOrNothing`, takes all of them or none. If the database
 * can't be asked, nothing is taken and `failed` is set, so an error can't
 * skip the limit.
 */
export async function reserveEmails(
  userId: string,
  kind: EmailKind,
  wanted: number,
  { allOrNothing = false }: { allOrNothing?: boolean } = {},
): Promise<EmailReservation> {
  if (wanted <= 0) return NOTHING;
  const { data, error } = await supabaseAdmin.rpc("reserve_emails", {
    p_user: userId,
    p_kind: kind,
    p_wanted: wanted,
    p_all_or_nothing: allOrNothing,
    p_basic_daily: DAILY_EMAILS.basic,
    p_star_daily: DAILY_EMAILS.star,
    p_basic_site_daily: BASIC_SITE_DAILY_EMAILS,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    console.error("[email-budget] Couldn't check the email limit:", error);
    return { ...NOTHING, failed: true };
  }
  return { id: row.reservation ?? null, granted: row.granted ?? 0, left: row.emails_left ?? 0, failed: false };
}

/** The error for a send that got no emails: the limit, or a failed check. */
export function noEmailsMessage(reservation: EmailReservation): string {
  return reservation.failed ? EMAILS_UNAVAILABLE : noEmailsLeftMessage();
}

/** Says how many of `wanted` emails may go out now. */
export type EmailAllowance = (wanted: number) => Promise<number>;

/**
 * The allowance for emails a visitor sets off on a list, event or group gift
 * (see visitor_email_sends in 20261117085323_visitor_email_limits.sql).
 * `pageId` is the list's, event's or group gift's id, and `ownerId` the
 * account that made it, whose level sets the limit. Each call takes what it
 * returns from the page's allowance. If the database can't be asked, it
 * returns 0, so an error can't skip the limit. A send that fails after this
 * still counts; that's rare and only makes the limit a little stricter.
 */
export function visitorEmailAllowance(
  page: { pageId: string; ownerId: string | null },
  kind: VisitorEmailKind,
): EmailAllowance {
  return async (wanted) => {
    if (wanted <= 0) return 0;
    const { data, error } = await supabaseAdmin.rpc("reserve_visitor_emails", {
      p_page: page.pageId,
      p_owner: page.ownerId,
      p_kind: kind,
      p_wanted: wanted,
      p_basic_daily: DAILY_VISITOR_EMAILS.basic,
      p_star_daily: DAILY_VISITOR_EMAILS.star,
      p_basic_site_daily: BASIC_SITE_DAILY_VISITOR_EMAILS,
    });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) {
      console.error("[email-budget] Couldn't check the visitor email limit:", error);
      return 0;
    }
    const granted = row.granted ?? 0;
    if (granted < wanted) {
      console.warn(`[email-budget] Skipped ${wanted - granted} ${kind} email(s): the page reached today's limit.`);
    }
    return granted;
  };
}

/**
 * Lowers a reservation to the number of emails that actually went out, so
 * failed sends don't count against the limit. Zero removes it.
 */
export async function settleEmails(reservation: EmailReservation, sent: number): Promise<void> {
  if (reservation.id === null || sent >= reservation.granted) return;
  const { error } =
    sent > 0
      ? await supabaseAdmin.from("email_sends").update({ emails: sent }).eq("id", reservation.id)
      : await supabaseAdmin.from("email_sends").delete().eq("id", reservation.id);
  if (error) console.error("[email-budget] Couldn't update a send:", error);
}
