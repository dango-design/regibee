/**
 * Pure HTML template functions for all Regibee emails.
 * Used by email.ts for sending and by Storybook for visual preview.
 *
 * Every template returns its HTML through emailLayout (src/lib/email-font.ts),
 * which sets the font and draws the wordmark, the card and the fine print. A
 * new template must too, or mail apps with no font of their own show it in
 * Times.
 *
 * Emails name a list by its title, never "your registry": the same email goes
 * to a baby registry, a birthday wishlist and a Christmas list.
 */

import { answerLabel } from "@/lib/rsvp-questions";
import { formatPrice } from "@/lib/money";
import { formatBirthdayDate } from "@/lib/gift-profile";
import {
  EMAIL_BOX_STYLE,
  EMAIL_MUTED,
  EMAIL_SMALL_STYLE,
  emailButton,
  emailCopyLink,
  emailItemCard,
  emailLayout,
  emailLink,
  emailLinks,
  emailQuote,
  escapeHtml,
  multiline,
} from "./email-font.ts";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** "2 of them · $89.99 each · Amazon", leaving out what isn't known. */
function itemDetails(opts: { quantity?: number; price?: number | null; storeName?: string | null }): string {
  const parts: string[] = [];
  const many = (opts.quantity ?? 1) > 1;
  if (many) parts.push(`${opts.quantity} of them`);
  if (opts.price) parts.push(`${formatPrice(opts.price)}${many ? " each" : ""}`);
  if (opts.storeName) parts.push(opts.storeName);
  return parts.join(" · ");
}

function formatPaymentBlock(paymentMethods?: { venmo?: string; paypal?: string; zelle?: string }): string {
  if (!paymentMethods || (!paymentMethods.venmo && !paymentMethods.paypal && !paymentMethods.zelle)) {
    return "";
  }
  const lines = [];
  if (paymentMethods.venmo) lines.push(`<strong>Venmo:</strong> ${escapeHtml(paymentMethods.venmo)}`);
  if (paymentMethods.paypal) lines.push(`<strong>PayPal:</strong> ${escapeHtml(paymentMethods.paypal)}`);
  if (paymentMethods.zelle) lines.push(`<strong>Zelle:</strong> ${escapeHtml(paymentMethods.zelle)}`);
  return `<p style="${EMAIL_BOX_STYLE}">If you haven't sent it yet:<br/>${lines.join("<br/>")}</p>`;
}

function registryStoreLine(parentName: string, storeName?: string): string {
  return storeName
    ? `<p>It's on ${escapeHtml(parentName)}'s ${escapeHtml(storeName)} registry, so buy it there and it counts toward the registry. ${escapeHtml(storeName)} has their address.</p>`
    : "";
}

function addressBlock(shippingAddress?: string): string {
  return shippingAddress
    ? `<p style="${EMAIL_BOX_STYLE}"><strong>Ship to:</strong><br/>${multiline(shippingAddress)}</p>`
    : "";
}

// ── Buyer Confirmations ──────────────────────────────────────

/** Sent when a guest reserves an item. The item is held for them while they buy it. */
export function itemReservedBuyerHtml(opts: {
  buyerName: string;
  itemTitle: string;
  quantity: number;
  parentName: string;
  registryTitle: string;
  holdDays: number;
  shippingAddress?: string;
  /** Set when the item is on the owners' own store registry, which has their address. */
  registryStoreName?: string;
  shopUrl?: string;
  storeName?: string;
  itemImageUrl?: string | null;
  itemPrice?: number | null;
  confirmUrl: string;
  releaseUrl: string;
}): string {
  const buyLabel = opts.storeName ? `Buy at ${opts.storeName}` : "Buy it";

  return emailLayout({
    preheader: `Buy it, then tell ${opts.parentName} it's from you.`,
    eyebrow: opts.registryTitle,
    heading: `It's held for you for ${opts.holdDays} days`,
    body: `
      ${emailItemCard({
        title: opts.itemTitle,
        imageUrl: opts.itemImageUrl,
        details: itemDetails({ quantity: opts.quantity, price: opts.itemPrice, storeName: opts.storeName }),
      })}
      <p>Nobody else can reserve it while you buy it.</p>
      ${registryStoreLine(opts.parentName, opts.registryStoreName)}
      ${addressBlock(opts.shippingAddress)}
      ${opts.shopUrl ? emailButton(opts.shopUrl, buyLabel) : ""}
      <p>When you've bought it, tell ${escapeHtml(opts.parentName)} so they know it's from you.</p>
      ${emailLinks([
        { href: opts.confirmUrl, label: "I bought it" },
        { href: opts.releaseUrl, label: "I'm not getting it" },
      ])}
      <p style="${EMAIL_SMALL_STYLE}">If you don't confirm within ${opts.holdDays} days, it goes back on the list for other guests.</p>`,
    footer: `You're getting this because you reserved a gift on ${escapeHtml(opts.registryTitle)}.`,
  });
}

/** Sent once, the day before a guest's reservation runs out. */
export function itemReservationReminderBuyerHtml(opts: {
  buyerName: string;
  itemTitle: string;
  parentName: string;
  registryTitle: string;
  /** Hours left, rounded. */
  hoursLeft: number;
  shippingAddress?: string;
  registryStoreName?: string;
  shopUrl?: string;
  storeName?: string;
  itemImageUrl?: string | null;
  itemPrice?: number | null;
  confirmUrl: string;
  releaseUrl: string;
}): string {
  const buyLabel = opts.storeName ? `Buy at ${opts.storeName}` : "Buy it";
  const hours = opts.hoursLeft === 1 ? "about an hour" : `about ${opts.hoursLeft} hours`;

  return emailLayout({
    preheader: `Already bought it? Tell ${opts.parentName} so they know it's from you.`,
    eyebrow: opts.registryTitle,
    heading: `Your hold ends in ${hours}`,
    body: `
      ${emailItemCard({
        title: opts.itemTitle,
        imageUrl: opts.itemImageUrl,
        details: itemDetails({ price: opts.itemPrice, storeName: opts.storeName }),
      })}
      <p>After that, it goes back on the list for other guests.</p>
      ${registryStoreLine(opts.parentName, opts.registryStoreName)}
      ${addressBlock(opts.shippingAddress)}
      ${opts.shopUrl ? emailButton(opts.shopUrl, buyLabel) : ""}
      <p>Already bought it? Tell ${escapeHtml(opts.parentName)} so they know it's from you.</p>
      ${emailLinks([
        { href: opts.confirmUrl, label: "I bought it" },
        { href: opts.releaseUrl, label: "I'm not getting it" },
      ])}`,
    footer: `You're getting this because you reserved a gift on ${escapeHtml(opts.registryTitle)}.`,
  });
}

/** Sent when a reservation ran out and the item went back on the list. */
export function itemReservationEndedBuyerHtml(opts: {
  buyerName: string;
  itemTitle: string;
  registryTitle: string;
  registryUrl?: string;
}): string {
  return emailLayout({
    preheader: "It's back on the list for other guests.",
    eyebrow: opts.registryTitle,
    heading: "Your hold ended",
    body: `
      <p>Your hold on <strong>${escapeHtml(opts.itemTitle)}</strong> ended, so it's back on the list for other guests.</p>
      <p>If you bought it anyway, or still want to, reserve it again. If someone else has, you could pick another gift.</p>
      ${opts.registryUrl ? emailButton(opts.registryUrl, "See the list") : ""}`,
    footer: `You're getting this because you reserved a gift on ${escapeHtml(opts.registryTitle)}.`,
  });
}

/** Sent when a guest says they bought the item. */
export function itemGivenBuyerHtml(opts: {
  buyerName: string;
  itemTitle: string;
  quantity: number;
  parentName: string;
  registryTitle: string;
  itemImageUrl?: string | null;
  registryUrl?: string;
  undoUrl?: string;
}): string {
  return emailLayout({
    preheader: `${opts.parentName} will see it's from you.`,
    eyebrow: opts.registryTitle,
    heading: "Thanks for your gift!",
    body: `
      ${emailItemCard({ title: opts.itemTitle, imageUrl: opts.itemImageUrl, details: itemDetails({ quantity: opts.quantity }) })}
      <p>${escapeHtml(opts.parentName)} will see it's from you, and will really appreciate it.</p>
      ${opts.registryUrl ? emailButton(opts.registryUrl, "See the list") : ""}
      ${emailLinks([{ href: opts.undoUrl, label: "Undo this gift" }])}`,
    footer: `You're getting this because you gave a gift on ${escapeHtml(opts.registryTitle)}.`,
  });
}

/**
 * Sent when a guest says they sent the owners the money for an item the owners
 * bought themselves. The gift is saved as given at once, so the guest gets a
 * way to undo it.
 */
export function itemCoveredBuyerHtml(opts: {
  buyerName: string;
  itemTitle: string;
  quantity: number;
  /** Price times quantity. Null when the item has no price. */
  amount: number | null;
  parentName: string;
  registryTitle: string;
  itemImageUrl?: string | null;
  registryUrl?: string;
  undoUrl?: string;
}): string {
  return emailLayout({
    preheader: `${opts.parentName} will see it's from you.`,
    eyebrow: opts.registryTitle,
    heading: opts.amount != null ? `Thanks for sending ${formatPrice(opts.amount)}!` : "Thanks for your gift!",
    body: `
      ${emailItemCard({ title: opts.itemTitle, imageUrl: opts.itemImageUrl, details: itemDetails({ quantity: opts.quantity }) })}
      <p>${escapeHtml(opts.parentName)} bought this themselves, and your money covers it. They'll see it's from you.</p>
      ${opts.registryUrl ? emailButton(opts.registryUrl, "See the list") : ""}
      ${emailLinks([{ href: opts.undoUrl, label: "Undo this gift" }])}
      <p style="${EMAIL_SMALL_STYLE}">Didn't send it after all? Undo the gift, and it goes back on the list.</p>`,
    footer: `You're getting this because you gave a gift on ${escapeHtml(opts.registryTitle)}.`,
  });
}

/** Sent when a guest gives to a gift fund. */
export function cashFundContributionBuyerHtml(opts: {
  buyerName: string;
  fundTitle: string;
  amount: number;
  parentName: string;
  registryTitle: string;
  paymentMethods?: { venmo?: string; paypal?: string; zelle?: string };
  registryUrl?: string;
}): string {
  return emailLayout({
    preheader: `${opts.parentName} will see it's from you.`,
    eyebrow: opts.registryTitle,
    heading: `Thanks for giving ${formatPrice(opts.amount)}!`,
    body: `
      <p>Your gift goes to <strong>${escapeHtml(opts.fundTitle)}</strong>. ${escapeHtml(opts.parentName)} will really appreciate it.</p>
      ${formatPaymentBlock(opts.paymentMethods)}
      ${opts.registryUrl ? emailButton(opts.registryUrl, "See the list") : ""}`,
    footer: `You're getting this because you gave to a gift fund on ${escapeHtml(opts.registryTitle)}. Regibee never handles the money.`,
  });
}

// ── Owner Notifications ──────────────────────────────────────

function managerFooter(registryTitle: string): string {
  return `You're getting this because you manage ${escapeHtml(registryTitle)} on Regibee.`;
}

/** Sent to the owners and managers when a guest says they bought an item. */
export function itemGivenOwnerHtml(opts: {
  ownerName: string;
  registryTitle: string;
  buyerName: string;
  itemTitle: string;
  quantity: number;
  itemImageUrl?: string | null;
  itemPrice?: number | null;
  message?: string | null;
  dashboardLink: string;
  /** Set when this is the first gift from a store registry whose welcome box needs one. */
  welcomeBox?: { storeName: string; boxName: string; perksLink: string } | null;
}): string {
  const welcomeBlock = opts.welcomeBox
    ? `<p style="background:#EAFBF5;border:1px solid #A0E4D4;border-radius:12px;padding:12px 14px;color:#074D31;">This is the first gift from your ${escapeHtml(opts.welcomeBox.storeName)} registry, so you may be able to request your ${escapeHtml(opts.welcomeBox.storeName)} ${escapeHtml(opts.welcomeBox.boxName)} now. ${emailLink(opts.welcomeBox.perksLink, "See your store perks")}</p>`
    : "";

  return emailLayout({
    preheader: opts.message ? `"${opts.message}"` : `${opts.itemTitle}, from ${opts.buyerName}.`,
    eyebrow: opts.registryTitle,
    heading: `${opts.buyerName} got you a gift`,
    body: `
      ${emailItemCard({
        title: opts.itemTitle,
        imageUrl: opts.itemImageUrl,
        details: itemDetails({ quantity: opts.quantity, price: opts.itemPrice }),
      })}
      ${opts.message ? emailQuote(opts.message, opts.buyerName) : ""}
      ${welcomeBlock}
      ${emailButton(opts.dashboardLink, "See your gifts")}`,
    footer: managerFooter(opts.registryTitle),
  });
}

/** Sent to the owners and managers when a guest says they sent the money for an item the owners bought. */
export function itemCoveredOwnerHtml(opts: {
  ownerName: string;
  registryTitle: string;
  buyerName: string;
  itemTitle: string;
  quantity: number;
  /** Price times quantity. Null when the item has no price. */
  amount: number | null;
  itemImageUrl?: string | null;
  message?: string | null;
  dashboardLink: string;
}): string {
  const sent = opts.amount != null ? formatPrice(opts.amount) : "money";

  return emailLayout({
    preheader: `It went straight to you, so look for it in Venmo, PayPal or Zelle.`,
    eyebrow: opts.registryTitle,
    heading: `${opts.buyerName} sent you ${sent}`,
    body: `
      ${emailItemCard({ title: opts.itemTitle, imageUrl: opts.itemImageUrl, details: itemDetails({ quantity: opts.quantity }) })}
      <p>It's for something you bought yourself. It went straight to you, so look for it in Venmo, PayPal or Zelle.</p>
      ${opts.message ? emailQuote(opts.message, opts.buyerName) : ""}
      ${emailButton(opts.dashboardLink, "See your gifts")}`,
    footer: managerFooter(opts.registryTitle),
  });
}

/** Sent to the owners and managers when a guest gives to a gift fund. */
export function cashFundContributionOwnerHtml(opts: {
  ownerName: string;
  registryTitle: string;
  buyerName: string;
  fundTitle: string;
  amount: number;
  message?: string | null;
  dashboardLink: string;
}): string {
  const formatted = formatPrice(opts.amount);

  return emailLayout({
    preheader: opts.message ? `"${opts.message}"` : `For ${opts.fundTitle}.`,
    eyebrow: opts.registryTitle,
    heading: `${opts.buyerName} gave ${formatted}`,
    body: `
      <p>It's for your gift fund <strong>${escapeHtml(opts.fundTitle)}</strong>. Look for it in Venmo, PayPal or Zelle.</p>
      ${opts.message ? emailQuote(opts.message, opts.buyerName) : ""}
      ${emailButton(opts.dashboardLink, "See your gifts")}`,
    footer: managerFooter(opts.registryTitle),
  });
}

/** Sent to the owners and managers when a guest suggests something for the list. */
export function newSuggestionOwnerHtml(opts: {
  ownerName: string;
  registryTitle: string;
  suggestedByName: string;
  title: string;
  price?: number | null;
  notes?: string | null;
  /** The list's page, where suggestions are accepted or declined. */
  listUrl?: string;
}): string {
  return emailLayout({
    preheader: opts.notes ? `"${opts.notes}"` : `Add it to the list, or decline it.`,
    eyebrow: opts.registryTitle,
    heading: `${opts.suggestedByName} suggested a gift`,
    body: `
      ${emailItemCard({ title: opts.title, details: itemDetails({ price: opts.price }) })}
      ${opts.notes ? emailQuote(opts.notes, opts.suggestedByName) : ""}
      <p>Add it to the list, or decline it.</p>
      ${opts.listUrl ? emailButton(opts.listUrl, "See the suggestion") : ""}`,
    footer: managerFooter(opts.registryTitle),
  });
}

/**
 * Sent once, the day after an event, to the owner of a list that hid what was
 * reserved from them: the gifts reserved before the event are revealed.
 */
export function giftsRevealedOwnerHtml(opts: {
  ownerName: string;
  registryTitle: string;
  eventTitle: string;
  giftCount: number;
  /** The list's Gift Activity tab. */
  listUrl: string;
}): string {
  const gifts = plural(opts.giftCount, "1 gift", `${opts.giftCount} gifts`);
  return emailLayout({
    preheader: `${gifts} from ${opts.eventTitle}. See what people picked, and who to thank.`,
    eyebrow: opts.registryTitle,
    heading: "Your gifts aren't a secret anymore",
    body: `
      <p>${escapeHtml(opts.eventTitle)} is over, so you can see what was reserved from your list. <strong>${gifts}</strong> came from it.</p>
      <p>See what people picked, and who to thank.</p>
      ${emailButton(opts.listUrl, "See your gifts")}
      <p style="${EMAIL_SMALL_STYLE}">Anything reserved from now on stays hidden from you, as before.</p>`,
    footer: `You're getting this because ${escapeHtml(opts.registryTitle)} hides what's been reserved from you and was part of ${escapeHtml(opts.eventTitle)}.`,
  });
}

// ── Store perks ──────────────────────────────────────────────

export function completionDiscountOwnerHtml(opts: {
  ownerName: string;
  registryTitle: string;
  /** Stores whose completion discount may have opened, with the discount. */
  stores: { name: string; amount: string }[];
  perksLink: string;
}): string {
  const items = opts.stores
    .map((s) => `<li><strong>${escapeHtml(s.name)}</strong>: ${escapeHtml(s.amount)}</li>`)
    .join("");
  const one = opts.stores.length === 1;

  return emailLayout({
    preheader: "A discount on what's still left on your store registry.",
    eyebrow: opts.registryTitle,
    heading: one ? "Your completion discount may be open" : "Your completion discounts may be open",
    body: `
      <p>Your due date is coming up, so ${one ? "this store's discount" : "these stores' discounts"} on what's still left on your store registry may be open now.</p>
      <ul style="padding-left:20px;margin:12px 0;">${items}</ul>
      <p>Rules differ by store, so check ${one ? "the store's" : "each store's"} terms before you buy.</p>
      ${emailButton(opts.perksLink, "See your store perks")}`,
    footer: `You're getting this because you linked store registries to ${escapeHtml(opts.registryTitle)}. You can turn off these emails on its Store perks tab.`,
  });
}

// ── Invitations ──────────────────────────────────────────────

export function managerInviteHtml(opts: {
  inviterName: string;
  registryTitle: string;
  inviteUrl: string;
}): string {
  return emailLayout({
    preheader: `${opts.inviterName} invited you to help manage it on Regibee.`,
    eyebrow: `From ${opts.inviterName}`,
    heading: `Help manage ${opts.registryTitle}`,
    body: `
      <p><strong>${escapeHtml(opts.inviterName)}</strong> invited you to help manage <strong>${escapeHtml(opts.registryTitle)}</strong>. You'll be able to add and edit items and see gift activity.</p>
      ${emailButton(opts.inviteUrl, "Accept the invite")}
      ${emailCopyLink(opts.inviteUrl)}`,
    footer: `You're getting this because ${escapeHtml(opts.inviterName)} entered your email address on Regibee. The invite expires in 7 days. If you don't know them, you can ignore this email.`,
  });
}

// ── Follows ──────────────────────────────────────────────────

export function followRequestHtml(opts: {
  followerName: string;
  profileUrl: string;
  reviewUrl: string;
  settingsUrl: string;
}): string {
  return emailLayout({
    preheader: "Approve, decline or block them from your account page.",
    heading: `${opts.followerName} wants to follow you`,
    body: `
      <p>If you approve, they'll see the lists you show to followers on your profile, as well as the ones you show to everyone. If you don't know them, you can decline the request or block them.</p>
      ${emailButton(opts.reviewUrl, "Review request")}
      ${emailLinks([{ href: opts.profileUrl, label: `See ${opts.followerName}'s profile` }])}`,
    footer: `You're getting this because someone asked to follow you on Regibee. ${emailLink(opts.settingsUrl, "Turn off these emails")}`,
  });
}

export function followInviteHtml(opts: {
  inviterName: string;
  inviteUrl: string;
}): string {
  const name = escapeHtml(opts.inviterName);
  return emailLayout({
    preheader: "Regibee is a gift list for babies, birthdays and other occasions.",
    heading: `${opts.inviterName} wants to follow you on Regibee`,
    body: `
      <p>Regibee is a gift list for babies, birthdays and other occasions. If you say yes, ${name} will see the lists you choose to show on your profile.</p>
      <p>You can say yes with a free account, and remove them as a follower whenever you like.</p>
      ${emailButton(opts.inviteUrl, "See the invite")}
      ${emailCopyLink(opts.inviteUrl)}`,
    footer: `You're getting this because ${name} entered your email address on Regibee. If you don't know them, you can ignore this email. The invite expires in 30 days.`,
  });
}

// ── Birthdays ────────────────────────────────────────────────

export interface BirthdayReminderEntry {
  /** "Glinda Upland", or a child's name. */
  name: string;
  /** The birthday, YYYY-MM-DD. */
  date: string;
  /** For a child's list: the parent who keeps it. */
  parentName?: string;
  linkUrl: string;
  /** What the link opens: their wishlist, or their profile. */
  linkTo: "list" | "profile";
}

/** "Glinda", "Glinda and Oz", "Glinda, Oz and Toto". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The subject of a birthday reminder. */
export function birthdayReminderSubject(birthdays: { name: string }[], days: number): string {
  const names = birthdays.map((b) => b.name);
  return names.length === 1
    ? `${names[0]}'s birthday is in ${days} days`
    : `${joinNames(names)} have birthdays in ${days} days`;
}

/**
 * Sent 10 days before the birthday of someone the reader follows, who
 * approved them. One email covers every birthday on that day.
 */
export function birthdayReminderHtml(opts: {
  toName: string | null;
  days: number;
  birthdays: BirthdayReminderEntry[];
  settingsUrl: string;
}): string {
  const linkLabel = (b: BirthdayReminderEntry) =>
    b.linkTo === "list" ? `See ${b.name}'s wishlist` : `See ${b.name}'s profile`;
  const whose = (b: BirthdayReminderEntry) =>
    `<strong>${escapeHtml(b.name)}</strong>${b.parentName ? ` (${escapeHtml(b.parentName)}'s list)` : ""}`;
  const date = formatBirthdayDate(opts.birthdays[0].date);
  const one = opts.birthdays.length === 1;

  const body = one
    ? (() => {
        const b = opts.birthdays[0];
        return `
      <p>${whose(b)} has a birthday on ${escapeHtml(date)}.</p>
      <p>${
        b.linkTo === "list"
          ? "Their wishlist shows what they'd love and what's already taken, with their sizes and the things to skip."
          : "Their profile has their wishlists, their sizes and the things to skip."
      }</p>
      ${emailButton(b.linkUrl, linkLabel(b))}`;
      })()
    : `
      <p>On ${escapeHtml(date)}:</p>
      <ul style="padding-left:20px;margin:12px 0;">
        ${opts.birthdays
          .map((b) => `<li style="margin-bottom:8px;">${whose(b)}: ${emailLink(b.linkUrl, linkLabel(b))}</li>`)
          .join("\n        ")}
      </ul>
      <p>Each wishlist shows what they'd love and what's already taken.</p>`;

  return emailLayout({
    preheader: one ? `On ${date}. See what they'd love.` : `On ${date}. See what they'd love.`,
    heading: one
      ? `${opts.birthdays[0].name}'s birthday is in ${opts.days} days`
      : `${opts.birthdays.length} birthdays in ${opts.days} days`,
    body,
    footer: `You're getting this because you follow ${one ? "them" : "these people"} on Regibee and they shared their birthday with their followers. ${emailLink(opts.settingsUrl, "Turn off birthday emails")}`,
  });
}

// ── Events ───────────────────────────────────────────────────

/** What every event email says about the event. Built by eventEmailDetails in email.ts. */
export interface EventEmailDetails {
  title: string;
  hostedBy?: string | null;
  /** "Saturday, March 14, 2026" */
  date?: string | null;
  /** "2 – 5 PM PDT" */
  time?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  mapUrl?: string | null;
  imageUrl?: string | null;
  rsvpBy?: string | null;
  /** The registries the event links. */
  registries?: { title: string; url: string }[];
  /** @deprecated One registry, from before events could link several. */
  registry?: { title: string; url: string } | null;
  /** "No gifts, please", as the host wrote it. */
  giftNote?: string | null;
  exchange?: {
    /** "everyone" for everyone gives everyone. Missing means names are drawn. */
    kind?: "draw" | "everyone";
    budget?: string | null;
    drawBy?: string | null;
    mailed: boolean;
  } | null;
  /** The event's sign-up sheet. A meal train has no get-together: guests pick a day to help. */
  signup?: { title: string; mealTrain: boolean } | null;
}

/** "Saturday, March 14 · 2 – 5 PM", for the inbox preview. */
function whenLine(event: EventEmailDetails): string {
  return [event.date, event.time].filter(Boolean).join(" · ");
}

function eventFactsBlock(event: EventEmailDetails): string {
  const rows: string[] = [];
  if (event.date) {
    rows.push(
      `<strong>When:</strong> ${escapeHtml(event.date)}${event.time ? `<br/>${escapeHtml(event.time)}` : ""}`,
    );
  }
  if (event.locationName || event.locationAddress) {
    const place = [event.locationName, event.locationAddress]
      .filter(Boolean)
      .map((part) => multiline(part!))
      .join("<br/>");
    const map = event.mapUrl ? `<br/>${emailLink(event.mapUrl, "Map")}` : "";
    rows.push(`<strong>Where:</strong> ${place}${map}`);
  }
  if (rows.length === 0) return "";
  return `<p style="${EMAIL_BOX_STYLE}">${rows.join("<br/><br/>")}</p>`;
}

/**
 * The host's gift note and the lists the event links. When everyone gives
 * everyone, like a family Christmas, the lists stay out: each guest's
 * wishlist is on the invitation, so the email sends them there instead.
 */
function registryLine(event: EventEmailDetails): string {
  const everyone = event.exchange?.kind === "everyone";
  const registries = everyone ? [] : (event.registries ?? (event.registry ? [event.registry] : []));
  const links = registries.map((r) => emailLink(r.url, r.title)).join(" · ");
  const lines: string[] = [];
  if (event.giftNote) lines.push(`<p>${multiline(event.giftNote)}</p>`);
  if (links) lines.push(`<p><strong>${registries.length === 1 ? "Gift list" : "Gift lists"}:</strong> ${links}</p>`);
  return lines.join("");
}

function exchangeLine(event: EventEmailDetails): string {
  if (!event.exchange) return "";
  if (event.exchange.kind === "everyone") {
    const each = event.exchange.budget ? ` Gifts are about ${escapeHtml(event.exchange.budget)} each.` : "";
    return `<p><strong>Gifts:</strong> everyone gives everyone. RSVP, then add your wishlist. Everyone's lists are on the invitation.${each}</p>`;
  }
  const budget = event.exchange.budget ? `, about ${escapeHtml(event.exchange.budget)}` : "";
  const when = event.exchange.drawBy ? ` Names are drawn by ${escapeHtml(event.exchange.drawBy)}.` : "";
  const how = event.exchange.mailed ? " Gifts are mailed." : "";
  return `<p><strong>Gift exchange:</strong> everyone who joins draws one name and gives that person a gift${budget}.${when}${how} Join when you RSVP.</p>`;
}

function signupLine(event: EventEmailDetails): string {
  if (!event.signup) return "";
  const what = event.signup.mealTrain
    ? "Pick a day to help when you reply. You'll get the drop-off address once you sign up."
    : "Pick what you'll bring when you RSVP.";
  return `<p><strong>${escapeHtml(event.signup.title)}:</strong> ${what}</p>`;
}

/**
 * Links that add the event to a calendar: Google's, and the event's .ics file
 * for Apple Calendar and Outlook. Empty when there's neither.
 */
function calendarLinks(googleUrl?: string | null, icsUrl?: string | null, label = "Add to calendar"): string {
  if (!googleUrl && !icsUrl) return "";
  const links = [
    googleUrl ? emailLink(googleUrl, "Google") : "",
    icsUrl ? emailLink(icsUrl, "Apple or Outlook") : "",
  ].filter(Boolean);
  return `<p style="margin:12px 0;">${escapeHtml(label)}: ${links.join(" &nbsp;·&nbsp; ")}</p>`;
}

function answersBlock(heading: string, answers: { label: string; value: string }[] | undefined): string {
  if (!answers || answers.length === 0) return "";
  const rows = answers
    .map((a) => `<li><strong>${escapeHtml(answerLabel(a.label))}</strong> ${escapeHtml(a.value)}</li>`)
    .join("");
  return `<p style="margin-bottom:0;">${escapeHtml(heading)}</p><ul style="margin:4px 0 16px;padding-left:20px;">${rows}</ul>`;
}

function signupList(claims: string[]): string {
  if (claims.length === 0) return "";
  return `<ul style="margin:4px 0 16px;padding-left:20px;">${claims.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`;
}

function guestListFooter(hostName: string, eventTitle: string): string {
  return `Reply to this email to reach ${escapeHtml(hostName)}. You're getting this because you're on the guest list for ${escapeHtml(eventTitle)} on Regibee.`;
}

/**
 * The invitation a host emails to a guest, and the reminder to guests who
 * haven't replied. The picture and the button both open the guest's own RSVP
 * link.
 */
export function eventInvitationHtml(opts: {
  guestName: string;
  /** Who's sending it: the host's name. */
  hostName: string;
  event: EventEmailDetails;
  /** The host's own words, shown as they wrote them. */
  message?: string | null;
  rsvpUrl: string;
  reminder?: boolean;
}): string {
  const { event } = opts;
  const image = event.imageUrl
    ? `<p style="margin:0 0 20px;"><a href="${escapeHtml(opts.rsvpUrl)}"><img src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.title)} invitation" style="display:block;width:100%;max-width:510px;height:auto;border-radius:12px;" /></a></p>`
    : "";
  const mealTrain = Boolean(event.signup?.mealTrain);
  const eyebrow = opts.reminder
    ? `Reminder from ${opts.hostName}`
    : mealTrain
      ? `${opts.hostName} is asking for help`
      : `${opts.hostName} invited you`;
  const intro = opts.reminder
    ? mealTrain
      ? `<p>${escapeHtml(opts.hostName)} is still looking for help.</p>`
      : `<p>${escapeHtml(opts.hostName)} would love to know if you can make it.</p>`
    : "";
  const hosted =
    event.hostedBy && event.hostedBy !== opts.hostName
      ? `<p style="color:${EMAIL_MUTED};">Hosted by ${escapeHtml(event.hostedBy)}</p>`
      : "";
  const rsvpBy = event.rsvpBy ? `<p style="${EMAIL_SMALL_STYLE}">Please reply by ${escapeHtml(event.rsvpBy)}.</p>` : "";

  return emailLayout({
    top: image,
    preheader: whenLine(event) || `From ${opts.hostName}.`,
    eyebrow,
    heading: event.title,
    body: `
      ${intro}
      ${hosted}
      ${eventFactsBlock(event)}
      ${opts.message ? `<p>${multiline(opts.message)}</p>` : ""}
      ${emailButton(opts.rsvpUrl, mealTrain ? "Pick a day" : "RSVP")}
      ${rsvpBy}
      ${signupLine(event)}
      ${registryLine(event)}
      ${exchangeLine(event)}
      <p style="${EMAIL_SMALL_STYLE}">This link is just for you, so you can change your answer later.</p>`,
    footer: `Reply to this email to reach ${escapeHtml(opts.hostName)}. You're getting this because ${escapeHtml(opts.hostName)} added you to the guest list for ${escapeHtml(event.title)} on Regibee.`,
  });
}

const RSVP_PHRASES: Record<"yes" | "no" | "maybe", string> = {
  yes: "You're going",
  maybe: "You might make it",
  no: "You can't make it",
};

/** Sent to a guest after they RSVP, when they gave an email address. */
export function rsvpGuestConfirmationHtml(opts: {
  guestName: string;
  status: "yes" | "no" | "maybe";
  partySize: number;
  event: EventEmailDetails;
  /** The guest's own link, to change the answer. */
  rsvpUrl: string;
  calendarUrl?: string | null;
  /** The event's .ics file, for Apple Calendar and Outlook. */
  icsUrl?: string | null;
  /** Whether the guest is in the event's gift exchange. */
  inExchange?: boolean;
  /** When everyone gives everyone: whether the guest has added a wishlist or gift ideas yet. */
  hasWishlist?: boolean;
  /** What the guest signed up for on the event's sign-up sheet. */
  signups?: string[];
  /** The guest's answers to the host's RSVP questions. */
  answers?: { label: string; value: string }[];
}): string {
  const { event } = opts;
  const signups = opts.signups ?? [];
  const mealTrain = Boolean(event.signup?.mealTrain);
  const exchange =
    !event.exchange || !opts.inExchange
      ? ""
      : event.exchange.kind === "everyone"
        ? opts.hasWishlist === false
          ? `<p><strong>Add your wishlist.</strong> Everyone gives everyone, so the others need to know what you'd like. ${emailLink(opts.rsvpUrl, "Add it on the invitation")}, where everyone's lists are, with what the others have reserved so nobody doubles up.</p>`
          : `<p><strong>Everyone gives everyone.</strong> Everyone's wishlists are on the invitation, with what the others have reserved so nobody doubles up. Nobody sees what's been reserved from their own list.</p>`
        : `<p><strong>You're in the gift exchange.</strong> ${
            event.exchange.drawBy ? `Names are drawn by ${escapeHtml(event.exchange.drawBy)}, and` : "When names are drawn,"
          } we'll email you who you're giving to.</p>`;
  const party = opts.status !== "no" && opts.partySize > 1 ? ` (${opts.partySize} people)` : "";
  const thanks =
    opts.status === "no"
      ? "Thanks for letting the host know."
      : opts.status === "maybe"
        ? "Thanks for letting the host know. If your plans firm up, change your answer anytime."
        : "Thanks for letting the host know. See you there!";
  const calendar = opts.status !== "no" ? calendarLinks(opts.calendarUrl, opts.icsUrl) : "";
  const heading = mealTrain
    ? opts.status === "no"
      ? "You can't help this time"
      : "You're signed up. Thank you!"
    : `${RSVP_PHRASES[opts.status]}${party}`;
  const signedUp =
    signups.length > 0
      ? `<p style="margin-bottom:0;"><strong>You signed up for:</strong></p>${signupList(signups)}${
          mealTrain ? "<p>The drop-off address is below. Only people who signed up see it.</p>" : ""
        }`
      : "";

  return emailLayout({
    preheader: opts.status === "no" ? "Thanks for letting the host know." : whenLine(event) || thanks,
    eyebrow: event.title,
    heading,
    body: `
      ${mealTrain ? "" : `<p>${thanks}</p>`}
      ${signedUp}
      ${answersBlock("Your answers:", opts.answers)}
      ${opts.status !== "no" ? eventFactsBlock(event) : ""}
      ${calendar}
      ${exchange}
      ${registryLine(event)}
      ${emailButton(opts.rsvpUrl, "See the invitation")}
      <p style="${EMAIL_SMALL_STYLE}">Plans changed? Use the same link to change your RSVP.</p>`,
    footer: `You're getting this because you replied to an invitation on Regibee.`,
  });
}

/** Tells the host that a guest replied. */
export function rsvpHostNotificationHtml(opts: {
  hostName: string;
  guestName: string;
  status: "yes" | "no" | "maybe";
  partySize: number;
  note?: string | null;
  eventTitle: string;
  /** Counts after this reply. */
  attending: number;
  pending: number;
  manageUrl: string;
  /** True when the guest wasn't on the list and added themselves from the event link. */
  newGuest?: boolean;
  /** What the guest signed up for on the sign-up sheet. */
  signups?: string[];
  /** A meal train: guests sign up to help instead of coming to something. */
  mealTrain?: boolean;
  /** The guest's answers to the RSVP questions. */
  answers?: { label: string; value: string }[];
}): string {
  const signups = opts.signups ?? [];
  const party = opts.partySize > 1 ? ` (${opts.partySize} people)` : "";
  const heading = opts.mealTrain
    ? opts.status === "no"
      ? `${opts.guestName} can't help this time`
      : `${opts.guestName} signed up to help`
    : opts.status === "yes"
      ? `${opts.guestName} is going${party}`
      : opts.status === "maybe"
        ? `${opts.guestName} might come${party}`
        : `${opts.guestName} can't make it`;
  const pendingText = plural(opts.pending, "1 guest hasn't", `${opts.pending} guests haven't`);
  const counts = opts.mealTrain
    ? ""
    : `So far, ${plural(opts.attending, "1 person is", `${opts.attending} people are`)} coming and ${pendingText} replied.`;
  const signedUp =
    signups.length > 0 ? `<p style="margin-bottom:0;">They signed up for:</p>${signupList(signups)}` : "";

  return emailLayout({
    preheader: counts || opts.eventTitle,
    eyebrow: opts.eventTitle,
    heading,
    body: `
      ${opts.newGuest ? `<p style="color:${EMAIL_MUTED};">They RSVPed from the event link, so they're now on your guest list.</p>` : ""}
      ${signedUp}
      ${answersBlock("Their answers:", opts.answers)}
      ${opts.note ? emailQuote(opts.note, opts.guestName) : ""}
      ${counts ? `<p>${counts}</p>` : ""}
      ${emailButton(opts.manageUrl, "See your guest list")}`,
    footer: `You're getting this because you asked to hear about RSVPs. You can turn these emails off on the event's Edit page.`,
  });
}

// ── Updates to guests (#100) ─────────────────────────────────

/** A message the host wrote to some of their guests. */
export function guestMessageHtml(opts: {
  guestName: string;
  hostName: string;
  eventTitle: string;
  /** The host's own words, shown as they wrote them. */
  body: string;
  rsvpUrl: string;
}): string {
  return emailLayout({
    preheader: opts.body.slice(0, 120),
    eyebrow: opts.eventTitle,
    heading: `A message from ${opts.hostName}`,
    body: `
      <div style="border-left:3px solid #004659;padding:4px 0 4px 14px;margin:0 0 16px;">${multiline(opts.body)}</div>
      ${emailLinks([{ href: opts.rsvpUrl, label: "See the invitation or change your RSVP" }])}`,
    footer: guestListFooter(opts.hostName, opts.eventTitle),
  });
}

/** Sent when the host changes the date, time or place. */
export function eventChangedHtml(opts: {
  guestName: string;
  hostName: string;
  event: EventEmailDetails;
  /** What changed, as "Date: Saturday, March 14, 2026 → Sunday, March 15, 2026". */
  changes: { label: string; before: string; after: string }[];
  rsvpUrl: string;
  calendarUrl?: string | null;
  /** The event's .ics file, for Apple Calendar and Outlook. */
  icsUrl?: string | null;
}): string {
  const { event } = opts;
  const rows = opts.changes
    .map(
      (c) =>
        `<li><strong>${escapeHtml(c.label)}:</strong> ${multiline(c.after)} <span style="color:${EMAIL_MUTED};">(was ${escapeHtml(c.before.replace(/\n/g, ", "))})</span></li>`,
    )
    .join("");
  const calendar = calendarLinks(opts.calendarUrl, opts.icsUrl, "Add the new time to your calendar");
  return emailLayout({
    preheader: opts.changes.map((c) => `${c.label}: ${c.after.replace(/\n/g, ", ")}`).join(" · "),
    eyebrow: event.title,
    heading: `${opts.hostName} changed the details`,
    body: `
      <ul style="padding-left:20px;line-height:1.6;margin:0 0 12px;">${rows}</ul>
      ${eventFactsBlock(event)}
      ${calendar}
      <p>If this changes your plans, change your RSVP so ${escapeHtml(opts.hostName)} knows.</p>
      ${emailButton(opts.rsvpUrl, "Change your RSVP")}`,
    footer: guestListFooter(opts.hostName, event.title),
  });
}

/** The day before the event, to everyone who said they're going. */
export function dayBeforeReminderHtml(opts: {
  guestName: string;
  hostName: string;
  event: EventEmailDetails;
  rsvpUrl: string;
  calendarUrl?: string | null;
  /** The event's .ics file, for Apple Calendar and Outlook. */
  icsUrl?: string | null;
  /** What the guest signed up to bring, as "Side (Mac and cheese)". */
  signups?: string[];
}): string {
  const { event } = opts;
  const signups = opts.signups ?? [];
  const calendar = calendarLinks(opts.calendarUrl, opts.icsUrl);
  const bringing =
    signups.length > 0 ? `<p style="margin-bottom:0;"><strong>You're bringing:</strong></p>${signupList(signups)}` : "";
  return emailLayout({
    preheader: [event.time, event.locationName].filter(Boolean).join(" · ") || "See you there!",
    eyebrow: "See you there!",
    heading: `${event.title} is tomorrow`,
    body: `
      ${eventFactsBlock(event)}
      ${bringing}
      ${calendar}
      <p>Can't make it after all? ${emailLink(opts.rsvpUrl, "Change your RSVP")} so ${escapeHtml(opts.hostName)} knows.</p>`,
    footer: `You're getting this because you said you're going to ${escapeHtml(event.title)} on Regibee.`,
  });
}
