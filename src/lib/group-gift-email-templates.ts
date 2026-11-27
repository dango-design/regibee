/**
 * HTML for the group gift emails (src/lib/group-gifts.ts). Pure functions,
 * like src/lib/email-templates.ts: group-gift-email.ts sends them and
 * Storybook previews them. Every value is escaped, because pledgers type
 * their names on a page anyone with the link can open, and the organizer
 * writes the payback note. Every template returns its HTML through
 * emailLayout, which sets the font.
 */

import { EMAIL_BOX_STYLE, EMAIL_SMALL_STYLE, emailButton, emailLayout, escapeHtml } from "./email-font.ts";

function paybackBox(organizerName: string, paybackNote: string | null | undefined): string {
  return paybackNote
    ? `<p style="${EMAIL_BOX_STYLE}">Pay ${escapeHtml(organizerName)} back: <strong>${escapeHtml(paybackNote)}</strong></p>`
    : "";
}

/** Sent to the organizer when they start a group gift, with the link to share. */
export function groupGiftStartedHtml(opts: {
  organizerName: string;
  itemTitle: string;
  recipientName: string;
  /** Like "$240". */
  goal?: string | null;
  paybackNote?: string | null;
  shareUrl: string;
}): string {
  return emailLayout({
    preheader: "Send the link to the people chipping in. They don't need an account.",
    eyebrow: `For ${opts.recipientName}`,
    heading: "Your group gift is set up",
    body: `
      <p><strong>${escapeHtml(opts.itemTitle)}</strong>${
        opts.goal ? `, collecting ${escapeHtml(opts.goal)}` : ""
      }. It's reserved in your name until you buy it, so nobody else will.</p>
      <p>Send this link to the people chipping in. They don't need an account.</p>
      <p style="${EMAIL_BOX_STYLE}"><a href="${escapeHtml(opts.shareUrl)}" style="color:#004659;word-break:break-all;">${escapeHtml(opts.shareUrl)}</a></p>
      ${opts.paybackNote ? `<p>They'll see how to pay you back: <strong>${escapeHtml(opts.paybackNote)}</strong></p>` : ""}
      ${emailButton(opts.shareUrl, "Open the group gift")}
      <p>When you've bought it, mark it bought on that page, and ${escapeHtml(opts.recipientName)} hears about it the usual way. ${escapeHtml(opts.recipientName)} only sees it's from you and others, never who chipped in.</p>
      <p style="${EMAIL_SMALL_STYLE}">Anyone with the link can see the group gift and chip in, so only share it with people you trust.</p>`,
    footer: "You're getting this because you started a group gift on Regibee.",
  });
}

/** Sent to someone who chipped in, with their own link to change it. */
export function groupGiftPledgedHtml(opts: {
  pledgerName: string;
  organizerName: string;
  itemTitle: string;
  recipientName: string;
  /** Like "$40". */
  amount: string;
  paybackNote?: string | null;
  pledgeUrl: string;
}): string {
  return emailLayout({
    preheader: `${opts.organizerName} is buying it, so send the money to them.`,
    eyebrow: `${opts.itemTitle} for ${opts.recipientName}`,
    heading: `You're chipping in ${opts.amount}`,
    body: `
      <p>${escapeHtml(opts.organizerName)} is buying <strong>${escapeHtml(opts.itemTitle)}</strong> for ${escapeHtml(opts.recipientName)}, so send the money to them.</p>
      ${paybackBox(opts.organizerName, opts.paybackNote)}
      ${emailButton(opts.pledgeUrl, "See the group gift")}
      <p style="${EMAIL_SMALL_STYLE}">Use that link to change your amount or take it back. It's yours, so don't forward this email.</p>`,
    footer: "You're getting this because you chipped in on a Regibee group gift. Regibee never handles the money.",
  });
}

/** Tells the organizer that someone chipped in. */
export function groupGiftNewPledgeHtml(opts: {
  organizerName: string;
  pledgerName: string;
  /** Like "$40". */
  amount: string;
  itemTitle: string;
  /** Like "$120 of $240", or "$120 so far". */
  progress: string;
  shareUrl: string;
}): string {
  return emailLayout({
    preheader: `That's ${opts.progress}.`,
    eyebrow: opts.itemTitle,
    heading: `${opts.pledgerName} is chipping in ${opts.amount}`,
    body: `
      <p style="${EMAIL_BOX_STYLE}"><strong>${escapeHtml(opts.progress)}</strong></p>
      <p>Mark it paid on the group gift page once they've sent it.</p>
      ${emailButton(opts.shareUrl, "Open the group gift")}`,
    footer: "You're getting this because you started a group gift on Regibee.",
  });
}

/** Tells someone who chipped in that the organizer called the gift off. */
export function groupGiftCalledOffHtml(opts: {
  pledgerName: string;
  organizerName: string;
  itemTitle: string;
  recipientName: string;
  /** The organizer had marked their pledge paid. */
  paid: boolean;
  /** The list, when guests can open it, so they can pick something else. */
  listUrl?: string | null;
  /** It ended because the organizer deleted their Regibee account. */
  accountClosed?: boolean;
}): string {
  return emailLayout({
    preheader: "You don't need to chip in.",
    eyebrow: `${opts.itemTitle} for ${opts.recipientName}`,
    heading: "The group gift was called off",
    body: `
      <p>${
        opts.accountClosed
          ? `${escapeHtml(opts.organizerName)} deleted their Regibee account, so the group gift is called off and you don't need to chip in.`
          : `${escapeHtml(opts.organizerName)} called off the group gift, so you don't need to chip in.`
      }</p>
      <p>${
        opts.paid
          ? `${escapeHtml(opts.organizerName)} had marked your share as paid. Ask them to send it back.`
          : `If you already sent ${escapeHtml(opts.organizerName)} money for it, ask them to send it back.`
      }</p>
      ${opts.listUrl ? emailButton(opts.listUrl, `See ${opts.recipientName}'s list`) : ""}`,
    footer: "You're getting this because you chipped in on a Regibee group gift.",
  });
}

/** Tells the organizer the pledges reached the goal, once. */
export function groupGiftFundedHtml(opts: {
  organizerName: string;
  itemTitle: string;
  recipientName: string;
  /** Like "$240 of $240". */
  progress: string;
  shareUrl: string;
}): string {
  return emailLayout({
    preheader: "Time to buy it. Mark it bought on the group gift page.",
    eyebrow: `${opts.itemTitle} for ${opts.recipientName}`,
    heading: "You've reached your goal",
    body: `
      <p style="${EMAIL_BOX_STYLE}"><strong>${escapeHtml(opts.progress)}</strong></p>
      <p>Everyone's chipped in enough for <strong>${escapeHtml(opts.itemTitle)}</strong>. Once you've bought it, mark it bought on the group gift page, and ${escapeHtml(opts.recipientName)} hears about it.</p>
      <p>Mark each share paid as the money comes in, so you know who still owes you.</p>
      ${emailButton(opts.shareUrl, "Open the group gift")}`,
    footer: "You're getting this because you started a group gift on Regibee.",
  });
}

/** Tells someone who chipped in that the organizer bought the gift. */
export function groupGiftBoughtHtml(opts: {
  pledgerName: string;
  organizerName: string;
  itemTitle: string;
  recipientName: string;
  /** Like "$40". */
  amount: string;
  /** The organizer marked their share paid. */
  paid: boolean;
  paybackNote?: string | null;
  pledgeUrl: string;
}): string {
  return emailLayout({
    preheader: opts.paid ? "Thanks for chipping in." : `Your ${opts.amount} goes to ${opts.organizerName}.`,
    eyebrow: `${opts.itemTitle} for ${opts.recipientName}`,
    heading: "The group gift is bought",
    body: `
      <p>${escapeHtml(opts.organizerName)} bought <strong>${escapeHtml(opts.itemTitle)}</strong> for ${escapeHtml(opts.recipientName)}. Thanks for chipping in!</p>
      ${
        opts.paid
          ? `<p>${escapeHtml(opts.organizerName)} marked your ${escapeHtml(opts.amount)} as paid, so you're all set.</p>`
          : `<p>If you haven't yet, send ${escapeHtml(opts.organizerName)} your ${escapeHtml(opts.amount)}.</p>${paybackBox(opts.organizerName, opts.paybackNote)}`
      }
      ${emailButton(opts.pledgeUrl, "See the group gift")}`,
    footer: "You're getting this because you chipped in on a Regibee group gift. Regibee never handles the money.",
  });
}
