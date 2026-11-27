// Server-only: emails about a guest's gift, and the daily job that reminds
// guests about open reservations and releases the ones that ran out. Every
// query here is filtered by a purchase id or item id, or by reservation status
// for the daily job. See src/lib/gifts.ts for how reservations work.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildBuyerRegistryUrl } from "@/lib/buyer-link";
import { GIFT_HOLD_DAYS, giftLinkUrl } from "@/lib/gifts";
import { classifyStoreLink, parseRetailerRegistries, registryStoreFor } from "@/lib/retailers";
import { welcomeBoxUnlockedBy } from "@/lib/store-perks-server";
import { visitorEmailAllowance } from "@/lib/email-budget";
import {
  confirmItemCovered,
  confirmItemGiven,
  confirmItemReserved,
  getRegistryInfoForBuyer,
  notifyItemCovered,
  notifyItemGiven,
  notifyItemReservationEnded,
  remindItemReservation,
  sendGiftRemovedEmail,
} from "@/lib/email";

const HOUR_MS = 60 * 60 * 1000;

/**
 * The daily job sends the one reminder on its first run with this many hours
 * or fewer left. With a 2-day hold and a run every 24 hours, that lands 12 to
 * 36 hours before the reservation ends.
 */
const REMIND_WITHIN_HOURS = 36;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/** An item photo's full URL, since mail apps can't load "/hero/x.svg". Null when there's none. */
function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? `${siteUrl()}${url}` : null;
}

/** "Amazon" for a known store, else the link's host, like "etsy.com". */
function storeNameFor(url: string | null): string | undefined {
  if (!url) return undefined;
  const known = classifyStoreLink(url)?.store.name;
  if (known) return known;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

async function loadGift(purchaseId: string) {
  const { data: purchase } = await supabaseAdmin
    .from("purchases")
    .select(
      "id, registry_item_id, buyer_name, buyer_email, quantity, message, status, reserved_until, reminders_sent, hide_giver"
    )
    .eq("id", purchaseId)
    .single();
  if (!purchase?.registry_item_id) return null;

  // A Secret Santa's row says "Secret Santa" with no email, so the list's
  // owners can't read who it was. Their real name and email are kept apart,
  // and every email this file sends to the giver needs them.
  if (purchase.hide_giver) {
    const { data: secret } = await supabaseAdmin
      .from("secret_givers")
      .select("buyer_name, buyer_email")
      .eq("purchase_id", purchaseId)
      .maybeSingle();
    if (secret) {
      purchase.buyer_name = secret.buyer_name;
      purchase.buyer_email = secret.buyer_email;
    }
  }

  const { data: item } = await supabaseAdmin
    .from("registry_items")
    .select("id, title, external_url, registry_id, price, image_url")
    .eq("id", purchase.registry_item_id)
    .single();
  if (!item) return null;

  const [registry, { data: settingsRow }] = await Promise.all([
    getRegistryInfoForBuyer({ itemId: item.id }),
    supabaseAdmin.from("registries").select("owner_id, registry_type, settings").eq("id", item.registry_id).single(),
  ]);
  if (!registry) return null;

  // An item on the owners' own store registry: the store has their address,
  // so the emails leave it out and point to the store. Baby registries only,
  // as on the registry page.
  const registryStoreName =
    settingsRow?.registry_type === "baby"
      ? registryStoreFor(
          item.external_url,
          parseRetailerRegistries(settingsRow.settings).map((r) => r.store)
        )?.name
      : undefined;

  const links = {
    confirmUrl: giftLinkUrl({ siteUrl: siteUrl(), slug: registry.slug, purchaseId, step: "confirm" }),
    releaseUrl: giftLinkUrl({ siteUrl: siteUrl(), slug: registry.slug, purchaseId, step: "release" }),
    registryUrl: purchase.buyer_email
      ? buildBuyerRegistryUrl({ siteUrl: siteUrl(), slug: registry.slug, buyerEmail: purchase.buyer_email })
      : `${siteUrl()}/r/${registry.slug}`,
  };
  return {
    purchase,
    item,
    // For the item card in the emails. Mail apps need a full URL.
    itemImageUrl: absoluteUrl(item.image_url as string | null),
    itemPrice: item.price != null ? Number(item.price) : null,
    registry,
    links,
    registryStoreName,
    storeName: registryStoreName || storeNameFor(item.external_url),
    // Emails a visitor sets off here count against the item's home list,
    // whose owner's level sets the limit.
    visitorAllowance: visitorEmailAllowance(
      { pageId: item.registry_id as string, ownerId: (settingsRow?.owner_id as string | undefined) ?? null },
      "gift",
    ),
  };
}

/** Sent right after a guest reserves an item. Counts against the list's visitor email limit. */
export async function sendReservationEmail(purchaseId: string) {
  const gift = await loadGift(purchaseId);
  if (!gift?.purchase.buyer_email) return;
  const { purchase, item, registry, links } = gift;

  await confirmItemReserved({
    allow: gift.visitorAllowance,
    buyerEmail: purchase.buyer_email,
    buyerName: purchase.buyer_name,
    itemTitle: item.title,
    quantity: purchase.quantity,
    parentName: registry.parentName,
    registryTitle: registry.registryTitle,
    holdDays: GIFT_HOLD_DAYS,
    shippingAddress: gift.registryStoreName ? undefined : registry.shippingAddress,
    registryStoreName: gift.registryStoreName,
    shopUrl: item.external_url || undefined,
    storeName: gift.storeName,
    itemImageUrl: gift.itemImageUrl,
    itemPrice: gift.itemPrice,
    confirmUrl: links.confirmUrl,
    releaseUrl: links.releaseUrl,
  });
}

/**
 * Sent once a guest says they bought the item: to the owners, and to the
 * guest. For a Secret Santa's gift, the owners' email says "Secret Santa"
 * instead of the giver's name. The guest's own email is unchanged.
 *
 * `by` is who said so. A visitor's count against the list's visitor email
 * limit. A group gift's organizer is signed in and emails nobody they typed
 * in, so theirs don't.
 */
export async function sendGiftConfirmedEmails(purchaseId: string, by: "visitor" | "organizer") {
  const gift = await loadGift(purchaseId);
  if (!gift) return;
  const { purchase, item, registry, links } = gift;
  const allow = by === "visitor" ? gift.visitorAllowance : undefined;

  // A first gift from a store registry can unlock that store's welcome box.
  const welcomeBox = await welcomeBoxUnlockedBy(item.id).catch((err) => {
    console.error("[perks] Failed to check welcome box:", err);
    return null;
  });

  await Promise.all([
    notifyItemGiven({
      allow,
      itemId: item.id,
      itemTitle: item.title,
      buyerName: purchase.buyer_name,
      hideGiver: !!purchase.hide_giver,
      quantity: purchase.quantity,
      itemImageUrl: gift.itemImageUrl,
      itemPrice: gift.itemPrice,
      message: purchase.message,
      welcomeBox,
    }),
    purchase.buyer_email
      ? confirmItemGiven({
          allow,
          buyerEmail: purchase.buyer_email,
          buyerName: purchase.buyer_name,
          itemTitle: item.title,
          quantity: purchase.quantity,
          parentName: registry.parentName,
          registryTitle: registry.registryTitle,
          itemImageUrl: gift.itemImageUrl,
          registryUrl: links.registryUrl,
          undoUrl: links.releaseUrl,
        })
      : Promise.resolve(),
  ]);
}

/**
 * Tells a guest their reservation ran out and the item went back on the list.
 * Counts against the list's visitor email limit, like the reminder, since a
 * visitor typed the address. Otherwise reservations saved after the limit
 * would still email every address on them.
 */
async function sendReservationEndedEmail(purchaseId: string) {
  const gift = await loadGift(purchaseId);
  if (!gift?.purchase.buyer_email) return;
  await notifyItemReservationEnded({
    allow: gift.visitorAllowance,
    buyerEmail: gift.purchase.buyer_email,
    buyerName: gift.purchase.buyer_name,
    itemTitle: gift.item.title,
    registryTitle: gift.registry.registryTitle,
    registryUrl: `${siteUrl()}/r/${gift.registry.slug}`,
  });
}

/**
 * Sent when a guest sends the owners money for an item they bought
 * themselves: to the owners, and to the guest with a link to undo it. For a
 * Secret Santa's gift, the owners' email says "Secret Santa" instead of the
 * giver's name. Counts against the list's visitor email limit.
 */
export async function sendCoverGiftEmails(purchaseId: string) {
  const gift = await loadGift(purchaseId);
  if (!gift) return;
  const { purchase, item, registry, links } = gift;
  const amount = item.price != null ? Number(item.price) * purchase.quantity : null;

  await Promise.all([
    notifyItemCovered({
      allow: gift.visitorAllowance,
      itemId: item.id,
      itemTitle: item.title,
      buyerName: purchase.buyer_name,
      hideGiver: !!purchase.hide_giver,
      quantity: purchase.quantity,
      amount,
      itemImageUrl: gift.itemImageUrl,
      message: purchase.message,
    }),
    purchase.buyer_email
      ? confirmItemCovered({
          allow: gift.visitorAllowance,
          buyerEmail: purchase.buyer_email,
          buyerName: purchase.buyer_name,
          itemTitle: item.title,
          quantity: purchase.quantity,
          amount,
          parentName: registry.parentName,
          registryTitle: registry.registryTitle,
          itemImageUrl: gift.itemImageUrl,
          registryUrl: links.registryUrl,
          undoUrl: links.releaseUrl,
        })
      : Promise.resolve(),
  ]);
}

/**
 * Releases reservations on one item whose time ran out, so another guest can
 * reserve it without waiting for the daily job. Returns the released purchase
 * ids, whose guests still need the "ended" email.
 */
export async function releaseExpiredOnItem(itemId: string): Promise<string[]> {
  const { data: expired } = await supabaseAdmin
    .from("purchases")
    .select("id")
    .eq("registry_item_id", itemId)
    .eq("status", "reserved")
    .not("reserved_until", "is", null)
    .lte("reserved_until", new Date().toISOString());

  const released: string[] = [];
  for (const row of expired ?? []) {
    const { data: changed, error } = await supabaseAdmin.rpc("release_registry_gift", {
      p_purchase_id: row.id,
    });
    if (error) console.error("[gifts] Failed to release an expired reservation:", error);
    else if (changed) released.push(row.id);
  }
  return released;
}

/** Emails the guests whose reservations releaseExpiredOnItem released. */
export async function sendReservationEndedEmails(purchaseIds: string[]) {
  for (const id of purchaseIds) await sendReservationEndedEmail(id);
}

/** Hours left, rounded, when the one reminder is due; otherwise null. */
export function reminderDue(reservedUntil: string, remindersSent: number, now: Date): number | null {
  const msLeft = new Date(reservedUntil).getTime() - now.getTime();
  if (msLeft <= 0 || remindersSent > 0) return null;
  if (msLeft > REMIND_WITHIN_HOURS * HOUR_MS) return null;
  return Math.max(1, Math.round(msLeft / HOUR_MS));
}

/**
 * Run once a day by /api/cron/gift-reservations. Releases reservations that ran
 * out and emails their guests, then sends a reminder for the ones ending soon.
 */
export async function processGiftReservations(now = new Date()) {
  let released = 0;
  let reminded = 0;

  const { data: releasedIds, error: releaseError } = await supabaseAdmin.rpc(
    "release_expired_registry_gifts"
  );
  if (releaseError) throw releaseError;

  for (const purchaseId of (releasedIds ?? []) as string[]) {
    released++;
    await sendReservationEndedEmail(purchaseId);
  }

  const { data: open, error: openError } = await supabaseAdmin
    .from("purchases")
    .select("id, reserved_until, reminders_sent")
    .eq("status", "reserved")
    .not("reserved_until", "is", null)
    .not("registry_item_id", "is", null)
    .eq("reminders_sent", 0)
    .gt("reserved_until", now.toISOString())
    .lte("reserved_until", new Date(now.getTime() + REMIND_WITHIN_HOURS * HOUR_MS).toISOString());
  if (openError) throw openError;

  for (const row of open ?? []) {
    const hoursLeft = reminderDue(row.reserved_until as string, row.reminders_sent ?? 0, now);
    if (hoursLeft === null) continue;

    // Claim the reminder before sending, so two runs can't both send it.
    const { data: claimed } = await supabaseAdmin
      .from("purchases")
      .update({ reminders_sent: 1 })
      .eq("id", row.id)
      .eq("status", "reserved")
      .eq("reminders_sent", 0)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const gift = await loadGift(row.id);
    if (!gift?.purchase.buyer_email) continue;
    await remindItemReservation({
      allow: gift.visitorAllowance,
      buyerEmail: gift.purchase.buyer_email,
      buyerName: gift.purchase.buyer_name,
      itemTitle: gift.item.title,
      parentName: gift.registry.parentName,
      registryTitle: gift.registry.registryTitle,
      hoursLeft,
      shippingAddress: gift.registryStoreName ? undefined : gift.registry.shippingAddress,
      registryStoreName: gift.registryStoreName,
      shopUrl: gift.item.external_url || undefined,
      storeName: gift.storeName,
      itemImageUrl: gift.itemImageUrl,
      itemPrice: gift.itemPrice,
      confirmUrl: gift.links.confirmUrl,
      releaseUrl: gift.links.releaseUrl,
    });
    reminded++;
  }

  return { released, reminded };
}

/** A guest's gift on an item that's about to be deleted, read before the delete takes it. */
export interface GiftOnDeletedItem {
  buyerName: string;
  buyerEmail: string;
  bought: boolean;
  itemTitle: string;
  parentName: string;
  registryTitle: string;
  /** The list's link, or null for a private list. */
  listUrl: string | null;
}

/**
 * The open gifts with an email address on these items: reservations and
 * gifts guests said they bought. Call it before deleting the items, since a
 * database trigger deletes their gifts with them.
 */
export async function giftsOnItems(itemIds: string[]): Promise<GiftOnDeletedItem[]> {
  if (itemIds.length === 0) return [];
  const { data: purchases } = await supabaseAdmin
    .from("purchases")
    .select("id, registry_item_id, buyer_name, buyer_email, status, hide_giver")
    .in("registry_item_id", itemIds)
    .in("status", ["reserved", "purchased"]);
  if (!purchases || purchases.length === 0) return [];

  // A hidden giver's real name and address are kept apart (secret_givers).
  const hidden = purchases.filter((p) => p.hide_giver).map((p) => p.id);
  const secrets = new Map<string, { buyer_name: string; buyer_email: string | null }>();
  if (hidden.length > 0) {
    const { data } = await supabaseAdmin.from("secret_givers").select("purchase_id, buyer_name, buyer_email").in("purchase_id", hidden);
    for (const row of data ?? []) secrets.set(row.purchase_id as string, row as { buyer_name: string; buyer_email: string | null });
  }

  const { data: items } = await supabaseAdmin
    .from("registry_items")
    .select("id, title, registry_id")
    .in("id", [...new Set(purchases.map((p) => p.registry_item_id as string))]);
  const itemById = new Map((items ?? []).map((i) => [i.id as string, i]));
  const registryIds = [...new Set((items ?? []).map((i) => i.registry_id as string))];
  const { data: registries } = await supabaseAdmin
    .from("registries")
    .select("id, title, slug, is_private, honoree_names, parent_names")
    .in("id", registryIds);
  const registryById = new Map((registries ?? []).map((r) => [r.id as string, r]));

  const gifts: GiftOnDeletedItem[] = [];
  for (const p of purchases) {
    const secret = secrets.get(p.id as string);
    const email = (secret?.buyer_email ?? p.buyer_email) as string | null;
    const item = itemById.get(p.registry_item_id as string);
    const registry = item ? registryById.get(item.registry_id as string) : undefined;
    if (!email || !item || !registry) continue;
    gifts.push({
      buyerName: (secret?.buyer_name ?? p.buyer_name) as string,
      buyerEmail: email,
      bought: p.status === "purchased",
      itemTitle: item.title as string,
      parentName: ((registry.honoree_names || registry.parent_names) as string | null) || "The list's owner",
      registryTitle: registry.title as string,
      listUrl: registry.is_private ? null : `${siteUrl()}/r/${registry.slug}`,
    });
  }
  return gifts;
}

/**
 * Tells each guest their gift went with a deleted item. `listGone` leaves the
 * link out, for when the whole list was deleted.
 */
export async function sendGiftRemovedEmails(gifts: GiftOnDeletedItem[], { listGone = false } = {}) {
  for (const gift of gifts) {
    await sendGiftRemovedEmail({ ...gift, listUrl: listGone ? null : gift.listUrl });
  }
}
