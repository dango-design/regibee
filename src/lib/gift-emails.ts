// How a list's managers hear about gifts by email, and the rules for the two
// emails that gather gifts: the daily summary and the thank-you reminder.
// The senders are in src/lib/gift-digest-server.ts.
//
// The phone app imports this file through @shared, so it imports nothing.

/** profiles.gift_emails. */
export type GiftEmails = "instant" | "daily" | "off";

export const GIFT_EMAIL_CHOICES: { value: GiftEmails; label: string }[] = [
  { value: "instant", label: "Each gift" },
  { value: "daily", label: "Once a day" },
  { value: "off", label: "Off" },
];

/** The hint under the choice, the same on the website and in the app. */
export const GIFT_EMAILS_HINT = "When someone gives a gift from a list you manage. Gifts you hid from yourself stay hidden.";

/** Reads a saved or sent value. Anything else is the default, one email per gift. */
export function parseGiftEmails(value: unknown): GiftEmails {
  return value === "daily" || value === "off" ? value : "instant";
}

// ── Daily summary ────────────────────────────────────────────

export interface DigestGift {
  registryId: string;
  /** "Auntie Glinda", or "Secret Santa" for a hidden giver. */
  shownName: string;
  title: string;
  kind: "given" | "covered" | "fund";
  quantity: number;
  /** For money: the amount sent. */
  amount: number | null;
  message: string | null;
  imageUrl: string | null;
}

export interface DigestList {
  registryId: string;
  title: string;
  gifts: DigestGift[];
}

/** Groups a manager's gifts by list, keeping lists and gifts in the order they came. */
export function groupDigest(gifts: DigestGift[], titles: Map<string, string>): DigestList[] {
  const lists = new Map<string, DigestList>();
  for (const gift of gifts) {
    const title = titles.get(gift.registryId);
    if (!title) continue;
    const list = lists.get(gift.registryId) ?? { registryId: gift.registryId, title, gifts: [] };
    list.gifts.push(gift);
    lists.set(gift.registryId, list);
  }
  return [...lists.values()];
}

/** "3 new gifts on Remi's Baby Registry", or "5 new gifts on your lists". */
export function digestSubject(lists: DigestList[]): string {
  const count = lists.reduce((sum, l) => sum + l.gifts.length, 0);
  const gifts = count === 1 ? "1 new gift" : `${count} new gifts`;
  return lists.length === 1 ? `${gifts} on ${lists[0].title}` : `${gifts} on your lists`;
}

// ── Thank-you reminder ───────────────────────────────────────

/** How many days after a list's date its owner gets the thank-you reminder. */
export const THANKS_REMINDER_DAYS = 3;

/** How many days late the daily job may still send it, after a missed run. */
export const THANKS_REMINDER_LATE_DAYS = 7;

/**
 * Whether a list's thank-you reminder is due. It goes once for each list
 * date, from THANKS_REMINDER_DAYS after it, and only when the list has gifts.
 * Lists that hide what's been reserved get the gifts revealed email instead,
 * which says who to thank.
 */
export function thanksReminderDue(
  list: { event_date: string | null; thanks_reminded_for: string | null; hidesReservations: boolean; giftCount: number },
  today: string,
): boolean {
  if (!list.event_date || list.hidesReservations || list.giftCount === 0) return false;
  if (list.thanks_reminded_for === list.event_date) return false;
  const due = shiftDate(list.event_date, THANKS_REMINDER_DAYS);
  return due <= today && today <= shiftDate(due, THANKS_REMINDER_LATE_DAYS);
}

/** A YYYY-MM-DD date moved by `days`. */
export function shiftDate(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}
