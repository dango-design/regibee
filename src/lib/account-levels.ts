// Account levels: basic and star. Every account is basic unless its email
// address is in the star_emails table, which we fill in by hand for people we
// know, like testers. See "Account levels" in CLAUDE.md and the migration
// 20261116074752_account_levels.sql.
//
// The levels only change limits on what costs money or reaches people who
// never signed up. Nobody can buy star, and the site never says which level
// an account is, so messages here talk about "today's limit" and never about
// upgrading.
//
// No imports, so unit tests can load this file on its own.

/**
 * How many emails to typed-in addresses an account can send in 24 hours:
 * invitations, reminders, messages to guests, change notices, name draws,
 * co-host and list-manager invites, list requests, and invites to follow.
 */
export const DAILY_EMAILS = { basic: 50, star: 500 } as const;

/**
 * How many of those emails all basic accounts together can send in 24 hours.
 * Resend's free plan sends 100 emails a day for the whole site, and account
 * emails and gift and RSVP confirmations need some of them. Raise this if
 * Resend moves to a paid plan, which has no daily cap.
 */
export const BASIC_SITE_DAILY_EMAILS = 60;

/**
 * How many emails one list, event or group gift can send in 24 hours because
 * of what visitors did there: gift, RSVP and chip-in confirmations to the
 * address they typed, a reservation's reminder and "ended" emails, and the
 * notices its owners get about gifts, RSVPs, chip-ins and suggestions. The
 * level is the page owner's. A gift or RSVP usually sends two emails, one to
 * the visitor and one to the owner.
 */
export const DAILY_VISITOR_EMAILS = { basic: 20, star: 200 } as const;

/**
 * How many of those emails the pages of all basic owners together can send
 * in 24 hours. With BASIC_SITE_DAILY_EMAILS, that leaves at least 10 of
 * Resend's free 100 a day for sign-up emails and the daily reminders. Raise
 * both if Resend moves to a paid plan.
 */
export const BASIC_SITE_DAILY_VISITOR_EMAILS = 30;

/** What a visitor did, as logged in visitor_email_sends.kind. */
export type VisitorEmailKind = "gift" | "suggestion" | "rsvp" | "pledge";

/** What a send was for, as logged in email_sends.kind. */
export type EmailKind =
  | "invitation"
  | "reminder"
  | "message"
  | "change"
  | "exchange"
  | "co_host_invite"
  | "manager_invite"
  | "list_request"
  | "follow_invite"
  | "cancellation";

const NONE_LEFT = "You've reached today's limit for emails. Try again tomorrow.";

/** When the limit couldn't be checked, so nothing was sent. */
export const EMAILS_UNAVAILABLE = "Emails can't be sent right now. Try again in a few minutes.";

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** For a single email, like a co-host invite, when none are left. */
export function noEmailsLeftMessage(): string {
  return NONE_LEFT;
}

/**
 * For invitations and reminders, which go to as many guests as the limit
 * allows. Null when everyone got one.
 */
export function partlySentMessage(sent: number, wanted: number): string | null {
  if (sent >= wanted) return null;
  if (sent === 0) return NONE_LEFT;
  const rest = wanted - sent;
  return `Sent to ${count(sent, "guest", "guests")}. You've reached today's limit for emails, so send to the other ${rest} tomorrow.`;
}

/**
 * For sends that go to everyone or no one, like a message to guests or a
 * name draw, when the limit doesn't cover them all.
 */
export function notEnoughLeftMessage(wanted: number, left: number, what: "message" | "draw"): string {
  if (left <= 0) return NONE_LEFT;
  const action = what === "draw" ? "Drawing names emails" : "This message would email";
  return `${action} ${count(wanted, "person", "people")}, and you can send ${left} more today. Try again tomorrow.`;
}
