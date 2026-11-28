import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadItemsForLists } from "@/lib/list-items";
import { givenOnElfster } from "@/lib/elfster-sync-server";
import { listPreview, type PreviewItem } from "@/lib/event-list-preview";
import { displayName } from "@/lib/profile-link";
import { giveGuestsTheirLinkedLists } from "@/lib/guest-linked-lists";
import {
  exchangeKind,
  type EventDetails,
  type EventGuest,
  type ExchangeGiftee,
  type GiftExchange,
  type GuestWishList,
  type LinkedRegistry,
} from "@/lib/events";
import type { SignupClaim, SignupItem, SignupSheet, SignupSheetWithRows } from "@/lib/signups";
import { invitationUpdates, type EventMessage, type InvitationUpdate } from "@/lib/event-updates";
import type { EventGuestContext } from "@/lib/event-guest-cookie";

// Reads for the event pages. The event tables have no access rules for the
// API roles (see 015_events.sql), so everything goes through the service-role
// client. Every read here is filtered by an id or slug the caller has already
// checked, or by the signed-in user's own id.

/** Registries the user owns or helps manage, for the event form's registry list. */
export async function getManageableRegistries(userId: string): Promise<{ id: string; title: string }[]> {
  const { data: managed } = await supabaseAdmin
    .from("registry_managers")
    .select("registry_id")
    .eq("user_id", userId);
  const ids = (managed || []).map((m) => m.registry_id as string);

  // Private lists can't be added to an event.
  const query = supabaseAdmin
    .from("registries")
    .select("id, title")
    .eq("is_private", false)
    .order("created_at", { ascending: false });
  const { data } = ids.length > 0
    ? await query.or(`owner_id.eq.${userId},id.in.(${ids.join(",")})`)
    : await query.eq("owner_id", userId);
  return (data || []) as { id: string; title: string }[];
}

/** Whether the user owns the registry or is one of its managers. */
export async function canManageRegistry(userId: string, registryId: string): Promise<boolean> {
  const [{ data: manager }, { data: registry }] = await Promise.all([
    supabaseAdmin
      .from("registry_managers")
      .select("id")
      .eq("registry_id", registryId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin.from("registries").select("owner_id").eq("id", registryId).maybeSingle(),
  ]);
  return Boolean(manager) || registry?.owner_id === userId;
}

/** Whether the user is a co-host of the event. The owner isn't on the list. */
async function isCoHost(eventId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("event_hosts")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * The event, if the user can manage it: its owner or a co-host. Null
 * otherwise, and for events that don't exist. Managing a registry the event
 * links to doesn't count: linking a list shows it to guests and gives nobody
 * rights over anything.
 */
export async function getEventForManager(
  eventId: string,
  userId: string,
): Promise<{ event: EventDetails; isOwner: boolean } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  const { data: event } = await supabaseAdmin.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return null;
  if (event.owner_id === userId) return { event: event as EventDetails, isOwner: true };
  if (await isCoHost(eventId, userId)) return { event: event as EventDetails, isOwner: false };
  return null;
}

export async function getEventGuests(eventId: string): Promise<EventGuest[]> {
  const { data } = await supabaseAdmin
    .from("event_guests")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at");
  return (data || []) as EventGuest[];
}

export type EventListEntry = EventDetails & {
  event_guests: { rsvp_status: EventGuest["rsvp_status"]; party_size: number; invited_at: string | null }[];
};

/** Events the user owns or co-hosts. */
export async function listEventsForUser(userId: string): Promise<EventListEntry[]> {
  const { data: hosted } = await supabaseAdmin.from("event_hosts").select("event_id").eq("user_id", userId);
  const ids = (hosted || []).map((h) => h.event_id as string);

  // The guests are the ones whose event_id is this event. The link is named
  // because exchange_exclusions also joins events and event_guests (twice,
  // by guest_a and guest_b), and without the name Supabase refuses the query
  // as ambiguous (PGRST201) and the Events tab comes back empty.
  const query = supabaseAdmin
    .from("events")
    .select("*, event_guests!event_guests_event_id_fkey(rsvp_status, party_size, invited_at)")
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  const { data, error } = ids.length > 0
    ? await query.or(`owner_id.eq.${userId},id.in.(${ids.join(",")})`)
    : await query.eq("owner_id", userId);
  if (error) console.error("[events] Failed to list events:", error);
  return (data || []) as EventListEntry[];
}

export type InvitedEventEntry = Pick<
  EventDetails,
  "id" | "slug" | "title" | "event_type" | "event_date" | "start_time" | "end_time" | "time_zone" | "image_url" | "hosted_by"
> & {
  rsvp_status: EventGuest["rsvp_status"];
  /** The user's own guest link token. */
  guest_token: string;
};

/**
 * Events someone else hosts where the user is on the guest list. A guest row
 * is the user's when it's linked to their account (they were invited from a
 * follow), or when it has the email address on their account and no other
 * account. Pass the email only once it's confirmed, so nobody sees
 * invitations sent to an address they haven't shown is theirs. Events the
 * user owns or co-hosts are left out: they're the user's to manage.
 */
export async function listInvitedEventsForUser(viewer: {
  id: string;
  email: string | null;
}): Promise<InvitedEventEntry[]> {
  type GuestRow = { event_id: string; rsvp_status: EventGuest["rsvp_status"]; token: string };
  const fields = "event_id, rsvp_status, token";
  // Guest emails are stored lowercased.
  const email = viewer.email?.trim().toLowerCase() || null;
  const [byAccount, byEmail, hosted] = await Promise.all([
    supabaseAdmin.from("event_guests").select(fields).eq("profile_id", viewer.id),
    email
      ? supabaseAdmin.from("event_guests").select(fields).eq("email", email).is("profile_id", null)
      : Promise.resolve({ data: [] as GuestRow[], error: null }),
    supabaseAdmin.from("event_hosts").select("event_id").eq("user_id", viewer.id),
  ]);
  if (byAccount.error || byEmail.error) {
    console.error("[events] Failed to list invitations:", byAccount.error ?? byEmail.error);
  }

  const hostedIds = new Set((hosted.data || []).map((h) => h.event_id as string));
  // One guest row per event. A row linked to the account comes first and wins.
  const guestByEvent = new Map<string, GuestRow>();
  for (const row of [...(byAccount.data || []), ...(byEmail.data || [])] as GuestRow[]) {
    if (!hostedIds.has(row.event_id) && !guestByEvent.has(row.event_id)) guestByEvent.set(row.event_id, row);
  }
  if (guestByEvent.size === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, slug, title, event_type, event_date, start_time, end_time, time_zone, image_url, hosted_by")
    .in("id", [...guestByEvent.keys()])
    // A host on their own guest list sees the event under the ones they host.
    .neq("owner_id", viewer.id)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) console.error("[events] Failed to list invited events:", error);

  return ((data || []) as Omit<InvitedEventEntry, "rsvp_status" | "guest_token">[]).map((event) => {
    const guest = guestByEvent.get(event.id)!;
    return { ...event, rsvp_status: guest.rsvp_status, guest_token: guest.token };
  });
}

/** Ids of the registries the user owns or helps manage. */
async function managedRegistryIds(userId: string): Promise<string[]> {
  const [{ data: managed }, { data: owned }] = await Promise.all([
    supabaseAdmin.from("registry_managers").select("registry_id").eq("user_id", userId),
    supabaseAdmin.from("registries").select("id").eq("owner_id", userId),
  ]);
  return [...new Set([...(managed || []).map((m) => m.registry_id as string), ...(owned || []).map((r) => r.id as string)])];
}

export type LinkedEventEntry = Pick<EventDetails, "id" | "slug" | "title" | "event_date" | "event_type"> & {
  /** Which of the user's registries it links. */
  registryTitles: string[];
};

/**
 * Events someone else hosts that link one of the user's registries, such as
 * a baby shower a friend is throwing. The user can't manage them, but should
 * know about them, and can unlink their registry.
 */
export async function listLinkedEventsForUser(userId: string): Promise<LinkedEventEntry[]> {
  const registryIds = await managedRegistryIds(userId);
  if (registryIds.length === 0) return [];

  const { data: links } = await supabaseAdmin
    .from("event_registries")
    .select("event_id, registries(title), events(id, slug, title, event_date, event_type, owner_id)")
    .in("registry_id", registryIds);
  if (!links || links.length === 0) return [];

  const { data: hosted } = await supabaseAdmin.from("event_hosts").select("event_id").eq("user_id", userId);
  const hostedIds = new Set((hosted || []).map((h) => h.event_id as string));

  const byEvent = new Map<string, LinkedEventEntry>();
  for (const link of links as unknown as {
    event_id: string;
    registries: { title: string } | null;
    events: (Pick<EventDetails, "id" | "slug" | "title" | "event_date" | "event_type"> & { owner_id: string }) | null;
  }[]) {
    const event = link.events;
    if (!event || event.owner_id === userId || hostedIds.has(event.id)) continue;
    const entry = byEvent.get(event.id) ?? {
      id: event.id,
      slug: event.slug,
      title: event.title,
      event_date: event.event_date,
      event_type: event.event_type,
      registryTitles: [],
    };
    if (link.registries?.title) entry.registryTitles.push(link.registries.title);
    byEvent.set(event.id, entry);
  }
  return [...byEvent.values()].sort((a, b) => (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999"));
}

export type RegistryEventEntry = Pick<EventDetails, "id" | "slug" | "title" | "event_date" | "event_type"> & {
  /** Whether the viewer hosts it. Hosts open the event's dashboard; others see the guest page. */
  canManage: boolean;
  /**
   * True when a guest added the list to the event as their wishlist, and no
   * host linked it. It comes off on that guest's RSVP, not with Unlink.
   */
  guestList: boolean;
};

/**
 * The events a registry is on, for the registry's dashboard page: the ones
 * whose hosts linked it, and the ones where a guest added it as their
 * wishlist. Soonest first, then events with no date.
 */
export async function listEventsForRegistry(registryId: string, viewerId: string): Promise<RegistryEventEntry[]> {
  const { linked, guestLists } = await eventIdsForRegistry(registryId);
  const ids = [...linked, ...guestLists];
  if (ids.length === 0) return [];

  const [{ data }, { data: hosted }] = await Promise.all([
    supabaseAdmin.from("events").select("id, slug, title, event_date, event_type, owner_id").in("id", ids),
    supabaseAdmin.from("event_hosts").select("event_id").eq("user_id", viewerId).in("event_id", ids),
  ]);
  const events = (data || []) as (Pick<EventDetails, "id" | "slug" | "title" | "event_date" | "event_type"> & {
    owner_id: string;
  })[];
  const hostedIds = new Set((hosted || []).map((h) => h.event_id as string));

  return events
    .map(({ owner_id, ...event }) => ({
      ...event,
      canManage: owner_id === viewerId || hostedIds.has(event.id),
      guestList: guestLists.has(event.id),
    }))
    .sort((a, b) => (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999"));
}

// ── Linked registries ────────────────────────────────────────

/** A registry item as the invitation previews it. */
export interface InvitationItem {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
}

/** A registry linked to an event, with what the invitation shows of it. */
export interface EventRegistry extends LinkedRegistry {
  id: string;
  /** Whose list it is, as the owner wrote it: "Remi & Max". */
  honoree: string | null;
  photo_url: string | null;
  linked_by: string | null;
  /** A few gifts that are still needed, for the preview. */
  items: InvitationItem[];
  /** How many items still need a giver. */
  itemsLeft: number;
  /**
   * Who owns the list, with withItems only. `name` is their account name
   * when they show this list on their profile, as the list's own page does,
   * and otherwise null. `accountName` is always their account name, for
   * showing the owner their own list. Both stay on the server: never send
   * the id or `accountName` to a page.
   */
  owner?: { id: string; name: string | null; accountName: string | null };
}

const PREVIEW_ITEMS = 4;

/**
 * The registries an event links, in the order they were linked. With
 * withItems, also a few gifts still needed from each, for the invitation.
 * managedByViewer says which of the lists the person looking manages. Gifts
 * from a synced Elfster wishlist count only on the others.
 */
export async function getEventRegistries(
  eventId: string,
  {
    withItems = false,
    managedByViewer,
  }: { withItems?: boolean; managedByViewer?: (registryIds: string[]) => Promise<string[]> } = {},
): Promise<EventRegistry[]> {
  const { data } = await supabaseAdmin
    .from("event_registries")
    .select(
      "linked_by, sort_order, created_at, registries(id, title, slug, honoree_names, parent_names, photo_url, owner_id, listed_on_profile)",
    )
    .eq("event_id", eventId)
    .order("sort_order")
    .order("created_at");
  const rows = ((data || []) as unknown as {
    linked_by: string | null;
    registries: {
      id: string;
      title: string;
      slug: string;
      honoree_names: string | null;
      parent_names: string | null;
      photo_url: string | null;
      owner_id: string;
      listed_on_profile: boolean | null;
    } | null;
  }[]).filter((row) => row.registries);

  const registries: EventRegistry[] = rows.map((row) => ({
    id: row.registries!.id,
    title: row.registries!.title,
    slug: row.registries!.slug,
    honoree: row.registries!.honoree_names?.trim() || row.registries!.parent_names?.trim() || null,
    photo_url: row.registries!.photo_url,
    linked_by: row.linked_by,
    items: [],
    itemsLeft: 0,
  }));
  if (!withItems || registries.length === 0) return registries;

  // Whose each list is. Like the list's own page (src/app/r/[slug]/page.tsx),
  // others see the owner's name only when they show the list on their profile.
  const ownerIds = [...new Set(rows.map((row) => row.registries!.owner_id))];
  const { data: owners } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ownerIds);
  const ownerNames = new Map((owners || []).map((o) => [o.id as string, displayName(o as { full_name: string | null })]));
  rows.forEach((row, i) => {
    const list = row.registries!;
    const accountName = ownerNames.get(list.owner_id) ?? null;
    registries[i].owner = {
      id: list.owner_id,
      name: list.listed_on_profile ? accountName : null,
      accountName,
    };
  });

  // Each list's own items and the ones its owner placed on it from their
  // other lists (src/lib/list-items.ts).
  //
  // A list kept in sync with an Elfster wishlist: what's been bought or
  // received there counts as taken, as on the list's own guest page. Only for
  // the lists the person looking doesn't manage. Elfster never shows owners
  // what's been bought for them, so neither do we. Without managedByViewer,
  // or if it fails, nothing from Elfster counts.
  const ids = registries.map((r) => r.id);
  type Row = PreviewItem & { registry_id: string; category_id: string | null; created_at: string; sort_order: number };
  const [itemsByList, managedIds] = await Promise.all([
    loadItemsForLists<Row>(
      ids,
      "id, registry_id, category_id, created_at, title, image_url, price, quantity_needed, quantity_fulfilled, is_essential, is_parent_purchased, sort_order",
    ).catch(() => new Map<string, Row[]>()),
    managedByViewer
      ? managedByViewer(ids).catch((err) => {
          console.error("[event] Couldn't tell which lists the viewer manages:", err);
          return ids;
        })
      : null,
  ]);
  const managed = managedIds ? new Set(managedIds) : null;
  const guestItemIds = managed
    ? registries.filter((r) => !managed.has(r.id)).flatMap((r) => (itemsByList.get(r.id) ?? []).map((item) => item.id))
    : [];
  const elfsterGiven = await givenOnElfster(guestItemIds);

  for (const registry of registries) {
    const asGuest = managed !== null && !managed.has(registry.id);
    const preview = listPreview(itemsByList.get(registry.id) ?? [], PREVIEW_ITEMS, asGuest ? elfsterGiven : undefined);
    registry.itemsLeft = preview.itemsLeft;
    registry.items = preview.items;
  }
  return registries;
}

/**
 * Finds a registry from its share link (https://regibee.com/r/<slug>), a
 * path (/r/<slug>), or the slug alone. Anyone with the link can see a
 * registry, so anyone with the link can link it to an event. Private lists
 * aren't found.
 */
export async function resolveRegistryLink(
  input: string,
): Promise<{ id: string; slug: string; title: string; honoree: string | null } | null> {
  const slug = registrySlugFromLink(input);
  if (!slug) return null;
  // A private list's link doesn't work for anyone else, here too.
  const { data } = await supabaseAdmin
    .from("registries")
    .select("id, slug, title, honoree_names, parent_names")
    .eq("slug", slug)
    .eq("is_private", false)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    honoree: data.honoree_names?.trim() || data.parent_names?.trim() || null,
  };
}

/** The slug in a registry link, or null when the text isn't one. */
export function registrySlugFromLink(input: string): string | null {
  const text = input.trim();
  if (!text || text.length > 500) return null;
  const fromPath = text.match(/(?:^|\/)r\/([a-z0-9][a-z0-9-]{0,120})(?:[/?#]|$)/i);
  if (fromPath) return fromPath[1].toLowerCase();
  if (/^[a-z0-9][a-z0-9-]{2,120}$/i.test(text)) return text.toLowerCase();
  return null;
}

// ── Co-hosts ─────────────────────────────────────────────────

export interface EventHost {
  userId: string;
  name: string;
  isOwner: boolean;
}

/** The owner and co-hosts, owner first. */
export async function getEventHosts(event: Pick<EventDetails, "id" | "owner_id">): Promise<EventHost[]> {
  const { data: rows } = await supabaseAdmin.from("event_hosts").select("user_id, created_at").eq("event_id", event.id).order("created_at");
  const ids = [event.owner_id, ...(rows || []).map((r) => r.user_id as string)];
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
  const names = new Map((profiles || []).map((p) => [p.id as string, (p.full_name as string | null)?.trim() || "Someone"]));
  return ids.map((id) => ({ userId: id, name: names.get(id) ?? "Someone", isOwner: id === event.owner_id }));
}

export interface HostInvite {
  id: string;
  email: string | null;
  token: string;
  expires_at: string;
}

/** Co-host invitations that haven't expired. */
export async function getHostInvites(eventId: string): Promise<HostInvite[]> {
  const { data } = await supabaseAdmin
    .from("event_host_invites")
    .select("id, email, token, expires_at")
    .eq("event_id", eventId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at");
  return (data || []) as HostInvite[];
}

// ── Gift exchanges ───────────────────────────────────────────

export async function getGiftExchange(eventId: string): Promise<GiftExchange | null> {
  const { data } = await supabaseAdmin.from("gift_exchanges").select("*").eq("event_id", eventId).maybeSingle();
  return (data as GiftExchange | null) ?? null;
}

export async function getExchangeExclusions(eventId: string): Promise<{ guest_a: string; guest_b: string }[]> {
  const { data } = await supabaseAdmin.from("exchange_exclusions").select("guest_a, guest_b").eq("event_id", eventId);
  return (data || []) as { guest_a: string; guest_b: string }[];
}

/** What a guest sees about the person they drew, or null before the draw. */
export async function getGifteeFor(eventId: string, gifteeId: string | null): Promise<ExchangeGiftee | null> {
  if (!gifteeId) return null;
  const { data: giftee } = await supabaseAdmin
    .from("event_guests")
    .select("name, wishlist_url, gift_ideas, shipping_address")
    .eq("event_id", eventId)
    .eq("id", gifteeId)
    .maybeSingle();
  if (!giftee) return null;
  const wishlist = giftee.wishlist_url ? await resolveRegistryLink(giftee.wishlist_url) : null;
  return {
    name: giftee.name,
    wishlistUrl: giftee.wishlist_url,
    wishlistTitle: wishlist?.title ?? null,
    giftIdeas: giftee.gift_ideas,
    shippingAddress: giftee.shipping_address,
  };
}

// ── Sign-up sheets ───────────────────────────────────────────

/** The event's sign-up sheet with its rows and claims, or null when it has none. */
export async function getSignupSheet(eventId: string): Promise<SignupSheetWithRows | null> {
  const { data: sheet } = await supabaseAdmin.from("signup_sheets").select("*").eq("event_id", eventId).maybeSingle();
  if (!sheet) return null;
  const { data: items } = await supabaseAdmin
    .from("signup_items")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("created_at");
  const ids = (items || []).map((i) => i.id as string);
  const { data: claims } = ids.length
    ? await supabaseAdmin.from("signup_claims").select("*").in("item_id", ids).order("created_at")
    : { data: [] };
  return {
    sheet: sheet as SignupSheet,
    items: (items || []) as SignupItem[],
    claims: (claims || []) as SignupClaim[],
  };
}

// ── Messages to guests ───────────────────────────────────────

/** What was emailed to the event's guests after the invitation, newest first. */
export async function getEventMessages(eventId: string, limit = 20): Promise<EventMessage[]> {
  const { data } = await supabaseAdmin
    .from("event_messages")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []) as EventMessage[];
}

/**
 * The host's messages and the changes to the date, time or place, newest
 * first, as the invitation shows them to anyone with its link (#129).
 */
export async function getInvitationUpdates(eventId: string, limit = 10): Promise<InvitationUpdate[]> {
  const { data, error } = await supabaseAdmin
    .from("event_messages")
    .select("id, kind, subject, body, created_at")
    .eq("event_id", eventId)
    .in("kind", ["message", "change"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[event] Failed to load updates:", error);
    return [];
  }
  return invitationUpdates((data || []) as Pick<EventMessage, "id" | "kind" | "subject" | "body" | "created_at">[]);
}

/** Other events the user can manage, newest first, for "copy guests from". */
export async function listOtherEventsForCopy(
  userId: string,
  exceptEventId: string,
): Promise<{ id: string; title: string; guestCount: number }[]> {
  const events = await listEventsForUser(userId);
  return events
    .filter((e) => e.id !== exceptEventId && e.event_guests.length > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((e) => ({ id: e.id, title: e.title, guestCount: e.event_guests.length }));
}

/** People the host asked to make a gift list, who haven't yet (see startPlan). */
export async function getPendingListRequests(eventId: string): Promise<{ name: string; email: string }[]> {
  const { data } = await supabaseAdmin
    .from("event_list_requests")
    .select("name, email")
    .eq("event_id", eventId)
    .is("fulfilled_at", null)
    .order("created_at");
  return (data || []) as { name: string; email: string }[];
}

// ── Everyone gives everyone ──────────────────────────────────

/**
 * Whether guests of this event can shop this registry as part of the event:
 * the event links it, or it's the wishlist of one of its guests and the
 * event's gift exchange is everyone gives everyone. (A Secret Santa's
 * wishlist is only for the person who drew them; the gift link route checks
 * that on its own.) With several registries, any one of them counts: an item
 * can be on several lists.
 */
export async function eventIncludesRegistry(eventId: string, registryIds: string | string[]): Promise<boolean> {
  const ids = Array.isArray(registryIds) ? registryIds : [registryIds];
  if (ids.length === 0) return false;
  const [{ data: links }, exchange, { data: wishlists }, { data: more }] = await Promise.all([
    supabaseAdmin.from("event_registries").select("registry_id").eq("event_id", eventId).in("registry_id", ids).limit(1),
    getGiftExchange(eventId),
    supabaseAdmin
      .from("event_guests")
      .select("id")
      .eq("event_id", eventId)
      .in("wishlist_registry_id", ids)
      .eq("in_exchange", true)
      .limit(1),
    // A guest's other lists (event_guest_lists).
    supabaseAdmin
      .from("event_guest_lists")
      .select("registry_id, event_guests!inner(event_id, in_exchange)")
      .in("registry_id", ids)
      .eq("event_guests.event_id", eventId)
      .eq("event_guests.in_exchange", true)
      .limit(1),
  ]);
  if ((links?.length ?? 0) > 0) return true;
  return exchangeKind(exchange) === "everyone" && (wishlists?.length ?? 0) + (more?.length ?? 0) > 0;
}

/**
 * The guest behind a gift link on their invitation
 * (/e/<event>/gifts?g=<token>&to=<list>), checked by their RSVP token. Null
 * when the event has no guest with that token.
 *
 * `registryIds` are the lists the gift is for. When one of them is the
 * wishlist of the person the guest drew in a gift exchange, the result says
 * whose Secret Santa they are. Otherwise the caller must check that the event
 * includes the list (eventIncludesRegistry) before treating the gift as part
 * of the event.
 *
 * The gift link route keeps the result in a signed cookie for the website
 * (src/lib/event-guest-cookie.ts). The phone app has no cookie, so it sends
 * the event and token with each request instead.
 */
export async function eventGuestFromToken(
  eventSlug: string,
  token: string,
  registryIds: string[],
): Promise<EventGuestContext | null> {
  if (!eventSlug || !token) return null;
  const { data: event } = await supabaseAdmin.from("events").select("id").eq("slug", eventSlug).maybeSingle();
  if (!event) return null;
  const { data: guest } = await supabaseAdmin
    .from("event_guests")
    .select("id, name, email, giftee_id")
    .eq("event_id", event.id)
    .eq("token", token)
    .maybeSingle();
  if (!guest) return null;

  // The guest's Secret Santa person, when their wishlist is one of these lists.
  let santa: EventGuestContext["santa"] = null;
  if (guest.giftee_id && registryIds.length > 0) {
    const { data: giftee } = await supabaseAdmin
      .from("event_guests")
      .select("name, wishlist_url")
      .eq("id", guest.giftee_id)
      .eq("event_id", event.id)
      .maybeSingle();
    const wishlistSlug = giftee?.wishlist_url ? registrySlugFromLink(giftee.wishlist_url) : null;
    if (giftee && wishlistSlug) {
      const { data: wishlist } = await supabaseAdmin.from("registries").select("id").eq("slug", wishlistSlug).maybeSingle();
      if (wishlist && registryIds.includes(wishlist.id as string)) {
        santa = { registryId: wishlist.id as string, gifteeName: giftee.name as string };
      }
    }
  }
  return {
    eventId: event.id as string,
    guestId: guest.id as string,
    name: guest.name as string,
    email: (guest.email as string | null) ?? null,
    santa,
  };
}

/** The ids of a guest's other lists on their event, besides their wishlist, oldest first. */
export async function getGuestMoreListIds(guestId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("event_guest_lists")
    .select("registry_id")
    .eq("guest_id", guestId)
    .order("created_at");
  return (data || []).map((row) => row.registry_id as string);
}

/**
 * Everyone's wishlists for an everyone-gives-everyone event: each guest
 * taking part, with their list or null when they haven't added one, and any
 * other lists of theirs they added (event_guest_lists). The viewer's own
 * entry comes first. Only the event's guests and hosts get this.
 */
export async function getGuestWishLists(eventId: string, viewerGuestId: string | null): Promise<GuestWishList[]> {
  const { data } = await supabaseAdmin
    .from("event_guests")
    .select("id, name, wishlist_url, wishlist_registry_id, gift_ideas")
    .eq("event_id", eventId)
    .eq("in_exchange", true)
    .order("name");
  const guests = (data || []) as Pick<EventGuest, "id" | "name" | "wishlist_url" | "wishlist_registry_id" | "gift_ideas">[];
  const { data: moreRows } = guests.length
    ? await supabaseAdmin
        .from("event_guest_lists")
        .select("guest_id, registry_id")
        .in(
          "guest_id",
          guests.map((g) => g.id),
        )
        .order("created_at")
    : { data: [] as { guest_id: string; registry_id: string }[] };
  const registryIds = [
    ...new Set([
      ...guests.map((g) => g.wishlist_registry_id).filter((id): id is string => Boolean(id)),
      ...(moreRows || []).map((row) => row.registry_id as string),
    ]),
  ];
  // Private lists are left out: nobody else can open them. The database
  // takes them off anyway (unshare_private_registry).
  const { data: registries } = registryIds.length
    ? await supabaseAdmin
        .from("registries")
        .select("id, title, slug, honoree_names, parent_names, is_private")
        .in("id", registryIds)
    : { data: [] };
  const byId = new Map(
    (registries || []).map((r) => [
      r.id as string,
      {
        title: r.title as string,
        slug: r.slug as string,
        honoree: (r.honoree_names as string | null)?.trim() || (r.parent_names as string | null)?.trim() || null,
        isPrivate: Boolean(r.is_private),
      },
    ]),
  );
  const listFor = (id: string | null | undefined) => {
    const list = id ? byId.get(id) : undefined;
    return list ? { title: list.title, slug: list.slug } : null;
  };

  return guests
    .map((g) => {
      const more = (moreRows || [])
        .filter((row) => row.guest_id === g.id && row.registry_id !== g.wishlist_registry_id)
        .map((row) => ({ id: row.registry_id as string, list: byId.get(row.registry_id as string) }))
        .filter((row): row is { id: string; list: NonNullable<typeof row.list> } => Boolean(row.list) && !row.list!.isPrivate)
        // Only the viewer's own entry carries the ids, to take a list off.
        .map(({ id, list: { title, slug, honoree } }) => ({
          title,
          slug,
          honoree,
          ...(g.id === viewerGuestId ? { id } : {}),
        }));
      return {
        guestId: g.id,
        name: g.name,
        isYou: g.id === viewerGuestId,
        url: g.wishlist_url,
        registry: listFor(g.wishlist_registry_id),
        giftIdeas: g.gift_ideas,
        ...(more.length > 0 ? { more } : {}),
      };
    })
    .sort((a, b) => Number(b.isYou) - Number(a.isYou));
}

/**
 * Everyone's wishlists, with each list the host linked put on its owner's
 * row when the owner is a guest with no wishlist of their own, matched by
 * email (src/lib/guest-linked-lists.ts). Takes the lists getEventRegistries
 * loaded withItems, which know their owners. The emails stay on the server.
 */
export async function withGuestsLinkedLists(
  lists: GuestWishList[],
  registries: EventRegistry[],
): Promise<GuestWishList[]> {
  const waiting = lists.filter((entry) => !entry.url && !entry.registry);
  const owned = registries.filter((registry) => registry.owner);
  if (waiting.length === 0 || owned.length === 0) return lists;

  const ownerIds = [...new Set(owned.map((registry) => registry.owner!.id))];
  const [{ data: guests }, ownerEmails] = await Promise.all([
    supabaseAdmin
      .from("event_guests")
      .select("id, email")
      .in(
        "id",
        waiting.map((entry) => entry.guestId),
      ),
    Promise.all(
      ownerIds.map(async (id) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        return [id, data?.user?.email ?? null] as const;
      }),
    ).then((pairs) => new Map(pairs)),
  ]);
  return giveGuestsTheirLinkedLists(
    lists,
    owned.map((registry) => ({
      slug: registry.slug,
      title: registry.title,
      ownerEmail: ownerEmails.get(registry.owner!.id) ?? null,
    })),
    new Map((guests || []).map((g) => [g.id as string, (g.email as string | null) ?? null])),
  );
}

// ── Reveals ──────────────────────────────────────────────────

/**
 * The ids of the events a registry is on. `linked` holds the events whose
 * hosts linked it. `guestLists` holds the events where a guest added it as
 * their wishlist or one of their other lists, and that no host linked.
 */
export async function eventIdsForRegistry(registryId: string): Promise<{ linked: Set<string>; guestLists: Set<string> }> {
  const [{ data: links }, { data: wishlists }, { data: more }] = await Promise.all([
    supabaseAdmin.from("event_registries").select("event_id").eq("registry_id", registryId),
    supabaseAdmin.from("event_guests").select("event_id").eq("wishlist_registry_id", registryId),
    supabaseAdmin.from("event_guest_lists").select("event_guests!inner(event_id)").eq("registry_id", registryId),
  ]);
  const linked = new Set((links || []).map((row) => row.event_id as string));
  const guestLists = new Set(
    [
      ...(wishlists || []).map((row) => row.event_id as string),
      ...(more || []).map((row) => (row.event_guests as unknown as { event_id: string }).event_id),
    ].filter((id) => !linked.has(id)),
  );
  return { linked, guestLists };
}

/**
 * The events a registry is linked to, by the event's own links or as a
 * guest's wishlist or one of their other lists. A list that hides reservations from its owner reveals
 * them the day after each one (src/lib/reveal.ts).
 */
export async function getEventsForReveal(
  registryId: string,
): Promise<Pick<EventDetails, "id" | "slug" | "title" | "event_date">[]> {
  const { linked, guestLists } = await eventIdsForRegistry(registryId);
  const ids = [...linked, ...guestLists];
  if (ids.length === 0) return [];
  const { data } = await supabaseAdmin.from("events").select("id, slug, title, event_date").in("id", ids);
  return (data || []) as Pick<EventDetails, "id" | "slug" | "title" | "event_date">[];
}

/**
 * The moment up to which a list's hidden gifts are revealed to its owner, or
 * null. The database works it out (gifts_revealed_through), the same as for
 * the owner's own reads. Before that function exists, nothing is revealed.
 */
export async function getGiftsRevealedThrough(registryId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("gifts_revealed_through", { p_registry_id: registryId });
  if (error) {
    console.error("[reveal] Failed to read when gifts are revealed:", error.message);
    return null;
  }
  return typeof data === "string" ? data : null;
}
