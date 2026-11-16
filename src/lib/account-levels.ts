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
 * co-host and list-manager invites, and list requests.
 */
export const DAILY_EMAILS = { basic: 50, star: 500 } as const;

/**
 * How many of those emails all basic accounts together can send in 24 hours.
 * Resend's free plan sends 100 emails a day for the whole site, and account
 * emails and gift and RSVP confirmations need some of them. Raise this if
 * Resend moves to a paid plan, which has no daily cap.
 */
export const BASIC_SITE_DAILY_EMAILS = 60;

/** What a send was for, as logged in email_sends.kind. */
export type EmailKind =
  | "invitation"
  | "reminder"
  | "message"
  | "change"
  | "exchange"
  | "co_host_invite"
  | "manager_invite"
  | "list_request";

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
