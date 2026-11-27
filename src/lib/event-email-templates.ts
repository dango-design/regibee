/**
 * HTML for the emails about co-hosts, linked registries and gift exchanges.
 * Pure functions, like src/lib/email-templates.ts: event-email.ts sends them
 * and Storybook previews them. Every value is escaped, because guests and
 * hosts type names, wishlists and addresses. Every template returns its HTML
 * through emailLayout, which sets the font.
 */

import {
  EMAIL_BOX_STYLE,
  EMAIL_SMALL_STYLE,
  emailButton,
  emailCopyLink,
  emailLayout,
  emailLink,
  escapeHtml,
  multiline,
} from "./email-font.ts";

/** Tells a registry's owners that someone linked it to their event. */
export function registryLinkedHtml(opts: {
  ownerName: string;
  linkedByName: string;
  registryTitle: string;
  eventTitle: string;
  eventDate?: string | null;
  eventUrl: string;
  registryDashboardUrl: string;
}): string {
  const when = opts.eventDate ? ` on ${escapeHtml(opts.eventDate)}` : "";
  return emailLayout({
    preheader: `Guests see your list on the invitation. ${opts.linkedByName} can't change it.`,
    eyebrow: opts.registryTitle,
    heading: `${opts.linkedByName} added your list to an event`,
    body: `
      <p><strong>${escapeHtml(opts.linkedByName)}</strong> linked <em>${escapeHtml(opts.registryTitle)}</em> to <strong>${escapeHtml(opts.eventTitle)}</strong>${when}.</p>
      <p>Guests see your list on the invitation, so they know what to bring. ${escapeHtml(opts.linkedByName)} can't change your list or see who gave what.</p>
      ${emailButton(opts.eventUrl, "See the invitation")}
      <p style="${EMAIL_SMALL_STYLE}">Didn't expect this? You can unlink it from ${emailLink(opts.registryDashboardUrl, "your list's page")}.</p>`,
    footer: `You're getting this because you manage ${escapeHtml(opts.registryTitle)} on Regibee.`,
  });
}

/** Invites someone to co-host an event. */
export function coHostInviteHtml(opts: { inviterName: string; eventTitle: string; inviteUrl: string }): string {
  return emailLayout({
    preheader: `${opts.inviterName} asked you to co-host on Regibee.`,
    eyebrow: `From ${opts.inviterName}`,
    heading: `Co-host ${opts.eventTitle}`,
    body: `
      <p><strong>${escapeHtml(opts.inviterName)}</strong> asked you to co-host <strong>${escapeHtml(opts.eventTitle)}</strong>.</p>
      <p>Co-hosts can edit the event, add guests, send invitations and reminders, see RSVPs and draw names.</p>
      ${emailButton(opts.inviteUrl, "Co-host this event")}
      ${emailCopyLink(opts.inviteUrl)}`,
    footer: `You're getting this because ${escapeHtml(opts.inviterName)} entered your email address on Regibee. The invitation expires in 14 days. If you don't know them, you can ignore this email.`,
  });
}

/**
 * Asks the person an event is for to make a gift list. The list is linked to
 * the event as soon as they make it.
 */
export function listRequestHtml(opts: {
  honoreeName: string;
  hostName: string;
  eventTitle: string;
  eventDate?: string | null;
  /** "baby registry", "birthday wishlist". */
  listNoun: string;
  requestUrl: string;
}): string {
  const when = opts.eventDate ? ` on ${escapeHtml(opts.eventDate)}` : "";
  return emailLayout({
    preheader: `So guests know what you'd like. Add things from any store.`,
    eyebrow: opts.eventTitle,
    heading: `${opts.hostName} asked you to make a ${opts.listNoun}`,
    body: `
      <p><strong>${escapeHtml(opts.hostName)}</strong> is planning <strong>${escapeHtml(opts.eventTitle)}</strong>${when}, and asked you to make a ${escapeHtml(opts.listNoun)} so guests know what you'd like.</p>
      <p>Add things from any store. Your list is linked to the invitation as soon as you make it, and guests reserve gifts without needing an account. ${escapeHtml(opts.hostName)} can't change your list.</p>
      ${emailButton(opts.requestUrl, `Make my ${opts.listNoun}`)}
      ${emailCopyLink(opts.requestUrl)}`,
    footer: `You're getting this because ${escapeHtml(opts.hostName)} entered your email address on Regibee. If you don't know them, you can ignore this email.`,
  });
}

/** Tells one person in a gift exchange whose name they drew. */
export function exchangeAssignmentHtml(opts: {
  giverName: string;
  gifteeName: string;
  eventTitle: string;
  hostName: string;
  budget?: string | null;
  /** "Saturday, December 19, 2026" */
  eventDate?: string | null;
  mailed: boolean;
  wishlist?: { url: string; title?: string | null } | null;
  giftIdeas?: string | null;
  shippingAddress?: string | null;
  /** The giver's own link: it shows their person and their own wishlist. */
  pageUrl: string;
  /** Names were drawn a second time, so this replaces an earlier email. */
  redraw?: boolean;
  /** The giver is the host, taking part too. */
  giverIsHost?: boolean;
}): string {
  const facts: string[] = [];
  if (opts.budget) facts.push(`<strong>Budget:</strong> ${escapeHtml(opts.budget)}`);
  if (opts.eventDate) {
    facts.push(`<strong>${opts.mailed ? "Mail it in time for" : "Bring it on"}:</strong> ${escapeHtml(opts.eventDate)}`);
  }
  if (opts.wishlist) {
    facts.push(`<strong>Their wishlist:</strong> ${emailLink(opts.wishlist.url, opts.wishlist.title || opts.wishlist.url)}`);
  }
  if (opts.giftIdeas) facts.push(`<strong>Their gift ideas:</strong><br/>${multiline(opts.giftIdeas)}`);
  if (opts.mailed && opts.shippingAddress) {
    facts.push(`<strong>Mail it to:</strong><br/>${multiline(opts.shippingAddress)}`);
  }
  const none =
    !opts.wishlist && !opts.giftIdeas
      ? `<p>${escapeHtml(opts.gifteeName)} hasn't added a wishlist or gift ideas yet. Your link below shows them as soon as they do.</p>`
      : "";

  return emailLayout({
    preheader: "Keep it a secret!",
    eyebrow: opts.redraw ? `${opts.eventTitle} · names drawn again` : opts.eventTitle,
    heading: `You're getting a gift for ${opts.gifteeName}`,
    body: `
      ${
        opts.redraw
          ? `<p>${escapeHtml(opts.hostName)} drew names again, so this replaces the name you got before.</p>`
          : ""
      }
      ${facts.length > 0 ? `<p style="${EMAIL_BOX_STYLE}">${facts.join("<br/><br/>")}</p>` : ""}
      ${none}
      <p>Keep it a secret! Nobody else knows who drew whom${opts.giverIsHost ? "" : `, not even ${escapeHtml(opts.hostName)}`}.</p>
      ${emailButton(opts.pageUrl, "See your Secret Santa page")}
      <p style="${EMAIL_SMALL_STYLE}">This link is just for you. It always shows your person's latest wishlist${opts.mailed ? " and address" : ""}.</p>`,
    footer: `You're getting this because you joined the gift exchange for ${escapeHtml(opts.eventTitle)} on Regibee. Reply to this email to reach ${escapeHtml(opts.hostName)}.`,
  });
}
