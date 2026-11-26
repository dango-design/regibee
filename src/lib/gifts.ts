// Gift reservations, shared by the server and the browser.
//
// A guest reserves an item and buys it, then confirms. A reservation holds the
// item for GIFT_HOLD_DAYS, short on purpose so guests buy right away and a
// forgotten gift goes back on the list soon. A daily job sends one reminder
// and releases reservations that ran out (src/lib/gift-reservations-server.ts).
// See supabase/migrations/015_gift_reservations.sql.
//
// The mobile app uses this file too, through its @shared/* path, so it can't
// import anything.

/** How long a reservation holds an item before it goes back on the list. */
export const GIFT_HOLD_DAYS = 2;

/** A visitor's own gift on an item, as the public registry page sends it. */
export interface MyItemGift {
  purchaseId: string;
  /** "reserved" is held until reservedUntil. "purchased" means the guest bought it. */
  status: "reserved" | "purchased";
  reservedUntil: string | null;
  quantity: number;
}

interface PurchaseLike {
  status: string;
  reserved_until?: string | null;
}

/**
 * True for a reservation still waiting for the guest to buy it. Gifts saved
 * before reservations had an end date have no reserved_until, and count as
 * given.
 */
export function isOpenReservation(p: PurchaseLike): boolean {
  return p.status === "reserved" && !!p.reserved_until;
}

/**
 * True for a reservation whose time ran out. The daily job releases these, but
 * until it runs, pages treat the item as available again.
 */
export function isExpiredReservation(p: PurchaseLike, now = Date.now()): boolean {
  return isOpenReservation(p) && new Date(p.reserved_until!).getTime() <= now;
}

/**
 * A group gift's reservation (src/lib/group-gifts.ts) is held until its
 * organizer buys it, not for GIFT_HOLD_DAYS. Its reserved_until is set this
 * far out only so a forgotten one goes back on the list in the end.
 */
export const GROUP_GIFT_HOLD_DAYS = 365;

/** Ordinary reservations are held 30 days at most (reserve_registry_item). */
const LONGEST_DATED_HOLD_MS = 31 * 24 * 60 * 60 * 1000;

/**
 * True for a reservation held until it's bought, like a group gift's. Pages
 * show it as reserved with no end date, since the far-off date means nothing.
 */
export function isHeldUntilBought(p: PurchaseLike, now = Date.now()): boolean {
  return isOpenReservation(p) && new Date(p.reserved_until!).getTime() - now > LONGEST_DATED_HOLD_MS;
}

export function toMyItemGift(p: PurchaseLike & { id: string; quantity?: number | null }): MyItemGift {
  const open = isOpenReservation(p);
  return {
    purchaseId: p.id,
    status: open ? "reserved" : "purchased",
    reservedUntil: open ? p.reserved_until ?? null : null,
    quantity: p.quantity || 1,
  };
}

/**
 * The name a list's owners and managers see on a Secret Santa's gift, instead
 * of the giver's name. The purchase has hide_giver set. The giver still sees
 * their own name and gets their own emails.
 */
export const SECRET_GIVER_NAME = "Secret Santa";

interface GiverLike {
  buyer_name: string;
  hide_giver?: boolean | null;
}

/** The giver's name as the list's owners and managers may see it. */
export function giverNameForOwner(p: GiverLike): string {
  return p.hide_giver ? SECRET_GIVER_NAME : p.buyer_name;
}

/**
 * A purchase as the list's owners and managers may see it. For a Secret
 * Santa's gift, the name becomes SECRET_GIVER_NAME and the email is removed.
 * The message stays. Other purchases come back unchanged.
 */
export function maskGiverForOwner<T extends GiverLike & { buyer_email?: string | null }>(p: T): T {
  if (!p.hide_giver) return p;
  return {
    ...p,
    buyer_name: SECRET_GIVER_NAME,
    ...("buyer_email" in p ? { buyer_email: null } : {}),
  };
}

// ── An item's status on its owner's list ────────────────────────────────
//
// The website's item card (src/components/item-card.tsx) and the app's item
// row (mobile/src/components/item-row.tsx) both show this, so the owner reads
// the same words in both.

interface OwnerItem {
  quantity_needed: number;
  quantity_fulfilled: number;
  is_parent_purchased?: boolean | null;
}

type OwnerItemPurchase = PurchaseLike & GiverLike & { quantity?: number | null };

export interface OwnerItemStatus {
  /** The tag by the item's title. Null while the item still needs gifts. */
  tag: { kind: "purchased-by-you" | "gifted" | "reserved"; label: string } | null;
  /** "2 of 3 still needed", or "1 of 2 available to gift" once the owner bought it. */
  quantity: string;
}

/**
 * What an item's owner sees about its gifts. `purchases` are the item's gifts,
 * cancelled ones included. A gift that's only reserved reads as reserved until
 * the guest says they bought it.
 */
export function ownerItemStatus(item: OwnerItem, purchases: OwnerItemPurchase[] = []): OwnerItemStatus {
  const active = purchases.filter((p) => p.status !== "cancelled");
  const given = active.filter((p) => !isOpenReservation(p));
  const needed = item.quantity_needed;

  if (item.is_parent_purchased) {
    // Guests can still pay toward an item the owner bought.
    const covered = active.reduce((sum, p) => sum + (p.quantity || 0), 0);
    return {
      tag: { kind: "purchased-by-you", label: "Purchased by you" },
      quantity: `${needed - covered} of ${needed} available to gift`,
    };
  }

  const quantity = `${needed - item.quantity_fulfilled} of ${needed} still needed`;
  if (item.quantity_fulfilled < needed) return { tag: null, quantity };
  if (active.length === 0) return { tag: { kind: "gifted", label: "Gifted" }, quantity };

  const onlyReserved = given.length === 0;
  const first = given[0] ?? active[0];
  const others = active.length - 1;
  const more = others > 0 ? ` + ${others} other${others > 1 ? "s" : ""}` : "";
  return {
    tag: {
      kind: onlyReserved ? "reserved" : "gifted",
      label: `${onlyReserved ? "Reserved" : "Gifted"} by ${giverNameForOwner(first)}${more}`,
    },
    quantity,
  };
}

// ── A gift in its owner's gift activity ─────────────────────────────────
//
// The website's Gift Activity tab and dashboard cards, and the app's Gifts tab
// and registry cards, word each gift the same way.

type ActivityPurchase = PurchaseLike & { cash_fund_id?: string | null; quantity?: number | null };

export interface GiftActivityTag {
  kind: "gifted" | "reserved" | "covered" | "contribution" | "cancelled";
  label: string;
}

/**
 * The tag on a gift in the owner's list of gifts. `itemBoughtByOwner` is true
 * when the gift is money toward an item the owner bought themselves.
 */
export function giftActivityTag(p: ActivityPurchase, itemBoughtByOwner = false): GiftActivityTag {
  if (p.status === "cancelled") return { kind: "cancelled", label: "Cancelled" };
  if (p.cash_fund_id) return { kind: "contribution", label: "Contribution" };
  if (itemBoughtByOwner) return { kind: "covered", label: "Covered by guest" };
  if (isOpenReservation(p)) return { kind: "reserved", label: "Reserved by guest" };
  return { kind: "gifted", label: "Gifted by guest" };
}

/** What the gift was for: "2x Crib · until Nov 15", or the fund's name. */
export function giftActivityFor(p: ActivityPurchase, title: string): string {
  if (p.cash_fund_id) return title;
  const count = (p.quantity ?? 1) > 1 ? `${p.quantity}x ` : "";
  const until =
    isOpenReservation(p) && !isHeldUntilBought(p)
      ? ` · until ${formatReservedUntil(p.reserved_until!, "short")}`
      : "";
  return `${count}${title}${until}`;
}

/** "reserved an item" or "gifted an item", after the giver's name on a registry card. */
export function giftActivityAction(p: PurchaseLike): string {
  return isOpenReservation(p) ? "reserved an item" : "gifted an item";
}

/** "Nov 15, 2026", when the gift was made. */
export function formatGiftDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Hiding what's been reserved from a list's owner ─────────────────────
//
// A list's owner can choose not to see what people reserved or pledged, so
// their gifts stay a surprise. It's off by default. Regibee turns it on for a
// personal wishlist when its owner adds it to a gift exchange. Guests and
// co-managers still see everything, so nobody buys the same thing twice.
//
// The exception, copied from Giftster: a list kept for a child. The parent
// who keeps it needs to see what's been reserved, so the setting never
// applies to it.
//
// This only changes what the owner's own pages, app screens and emails show.
// The owner can still read the rows. It keeps a surprise, it isn't a lock.

/** The reservation settings in registries.settings. */
export interface ReservationPrivacy {
  /** "Hide what's been reserved from me". Missing means never chosen. */
  hide_reservations?: boolean;
  /** "owner" when the owner chose it, "exchange" when Regibee turned it on. */
  hide_reservations_source?: "owner" | "exchange";
  /** "I keep this list for my child". The owner always sees reservations. */
  for_child?: boolean;
}

/** The reservation settings from a registry's settings, whatever shape they're in. */
export function readReservationPrivacy(settings: unknown): ReservationPrivacy {
  const raw = (settings && typeof settings === "object" ? settings : {}) as Record<string, unknown>;
  return {
    hide_reservations: typeof raw.hide_reservations === "boolean" ? raw.hide_reservations : undefined,
    hide_reservations_source:
      raw.hide_reservations_source === "owner" || raw.hide_reservations_source === "exchange"
        ? raw.hide_reservations_source
        : undefined,
    for_child: raw.for_child === true,
  };
}

/** True when the list hides what's been reserved from its owner. */
export function hidesReservations(settings: unknown): boolean {
  const privacy = readReservationPrivacy(settings);
  return privacy.hide_reservations === true && !privacy.for_child;
}

/**
 * True when this person shouldn't see what's been reserved on this list: the
 * list hides it, and they're its owner. Co-managers and guests still see it.
 */
export function reservationsHiddenFrom(
  registry: { owner_id: string; settings?: unknown },
  viewerId: string | null | undefined,
): boolean {
  return Boolean(viewerId) && registry.owner_id === viewerId && hidesReservations(registry.settings);
}

/**
 * An item as its owner sees it with reservations hidden: nothing reserved.
 * An item the owner marked as bought themselves stays bought, since that was
 * their own doing.
 */
export function itemAsUnreserved<T extends { quantity_fulfilled: number; is_parent_purchased?: boolean | null }>(
  item: T,
): T {
  return item.is_parent_purchased ? item : { ...item, quantity_fulfilled: 0 };
}

/**
 * The notice an owner sees while what's been reserved is hidden from them. The
 * website's ReservationsHiddenNotice and the app's registry screen show it.
 * `next` is the next reveal, when the list is linked to an event.
 */
export function reservationsHiddenText(opts: {
  revealedCount?: number;
  next?: { date: string; eventTitle: string } | null;
  turnedOnByExchange?: boolean;
}): { title: string; revealed: string | null; next: string | null; why: string } {
  const revealed = opts.revealedCount ?? 0;
  return {
    title: revealed > 0 ? "New reservations are hidden from you" : "What's been reserved is hidden from you",
    revealed:
      revealed > 0
        ? `${revealed === 1 ? "1 gift from your last event is" : `${revealed} gifts from your last event are`} shown below, with who gave ${revealed === 1 ? "it" : "them"}.`
        : null,
    next: opts.next ? `Gifts reserved before ${opts.next.eventTitle} show on ${opts.next.date}.` : null,
    why: `${
      opts.turnedOnByExchange ? "Regibee turned this on for the gift exchange. " : ""
    }Guests still see what's taken.`,
  };
}

/** A cash fund as its owner sees it with reservations hidden: nothing pledged. */
export function fundAsUnpledged<T extends { current_amount: number }>(fund: T): T {
  return { ...fund, current_amount: 0 };
}

// ── Revealing hidden gifts after an event ───────────────────────────────
//
// When a list that hides reservations is linked to an event, its owner sees
// the gifts reserved before the event from the day after it, for thank-you
// notes. The database works out the moment (gifts_revealed_through in
// supabase/migrations/20261114035445_everyone_gives_everyone.sql) and stops
// the owner reading anything later. These helpers show the owner the gifts
// that are revealed and nothing else, whatever the rows say.

/** Whether a gift made at `createdAt` is revealed, given the list's reveal moment. */
export function isGiftRevealed(createdAt: string, revealedThrough: string | null | undefined): boolean {
  return Boolean(revealedThrough) && new Date(createdAt).getTime() < new Date(revealedThrough!).getTime();
}

interface RevealablePurchase {
  status: string;
  quantity?: number | null;
  amount?: number | string | null;
}

/**
 * An item as its owner sees it with reservations hidden and some gifts
 * revealed: only the revealed gifts count. `revealed` holds the item's
 * revealed purchases.
 */
export function itemAsRevealed<T extends { quantity_fulfilled: number; quantity_needed: number; is_parent_purchased?: boolean | null }>(
  item: T,
  revealed: RevealablePurchase[],
): T {
  if (item.is_parent_purchased) return item;
  const given = revealed.filter((p) => p.status !== "cancelled").reduce((sum, p) => sum + (p.quantity || 1), 0);
  return { ...item, quantity_fulfilled: Math.min(given, item.quantity_needed) };
}

/** A cash fund as its owner sees it with reservations hidden and some gifts revealed. */
export function fundAsRevealed<T extends { current_amount: number }>(fund: T, revealed: RevealablePurchase[]): T {
  const pledged = revealed.filter((p) => p.status !== "cancelled").reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return { ...fund, current_amount: pledged };
}

/**
 * A list's settings after its owner added it to a gift exchange as their
 * wishlist, or null when nothing changes. Hiding turns on for a personal
 * wishlist whose owner never chose either way and doesn't keep it for a child.
 * Registries such as a baby registry keep showing what's been reserved, since
 * their owners need it for thank-you notes.
 */
export function settingsAfterJoiningExchange(registry: {
  registry_type: string | null;
  settings: unknown;
}): Record<string, unknown> | null {
  if (registry.registry_type !== "personal") return null;
  const privacy = readReservationPrivacy(registry.settings);
  if (privacy.hide_reservations !== undefined || privacy.for_child) return null;
  const settings = (registry.settings && typeof registry.settings === "object" ? registry.settings : {}) as Record<
    string,
    unknown
  >;
  return { ...settings, hide_reservations: true, hide_reservations_source: "exchange" };
}

/** Steps a gift link can open the gift dialog at. */
export const GIFT_LINK_STEPS = ["buy", "confirm", "release"] as const;
export type GiftLinkStep = (typeof GIFT_LINK_STEPS)[number];

export function isGiftLinkStep(value: unknown): value is GiftLinkStep {
  return typeof value === "string" && (GIFT_LINK_STEPS as readonly string[]).includes(value);
}

/**
 * The link in a guest's emails back to their gift. The purchase id in it is
 * what lets the guest confirm or release the gift, the same as the id in their
 * gifts cookie, so it only ever goes to the guest's own email address.
 */
export function giftLinkUrl(opts: {
  siteUrl: string;
  slug: string;
  purchaseId: string;
  step?: GiftLinkStep;
}): string {
  const base = `${opts.siteUrl}/r/${opts.slug}/gift/${opts.purchaseId}`;
  return opts.step ? `${base}?step=${opts.step}` : base;
}

/** "Sun, Nov 15" in the viewer's time zone. */
export function formatReservedUntil(iso: string, style: "long" | "short" = "long"): string {
  const date = new Date(iso);
  return style === "long"
    ? date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
