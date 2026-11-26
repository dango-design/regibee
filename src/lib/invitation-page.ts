// What an event's invitation loads, for the website's page (/e/<slug>) and
// the phone app's invitation screen (through /api/app/data). Both show the
// same thing to the same person.
//
// Event pages are read with the service-role client, always filtered by the
// slug in the link (and a guest's token). The event tables have no access
// rules for the API roles, so the anon key can't list events or guests. The
// result holds only what the invitation shows: no owner, guest emails or
// account ids.

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { groupGiftsForEvent, listsOfViewer } from "@/lib/group-gifts-server";
import {
  getEventForManager,
  getEventRegistries,
  getGifteeFor,
  getGiftExchange,
  getGuestWishLists,
  getInvitationUpdates,
  getSignupSheet,
  registrySlugFromLink,
  withGuestsLinkedLists,
} from "@/lib/events-server";
import { hidesAddressUntilSignup, signupRowsForGuest, withAddressFor } from "@/lib/signups";
import { storedAnswers, storedQuestions } from "@/lib/rsvp-questions";
import { eventHasPassed, exchangeKind, googleCalendarUrl, type EventDetails, type EventGuest } from "@/lib/events";
import { getViewer, getViewerRelation } from "@/lib/viewer";
import { guestFollowsFor } from "@/lib/guest-follows";
import type {
  InvitationEvent,
  InvitationPageData,
  InvitationRegistry,
  RsvpWishlistData,
} from "@/lib/invitation-page-types";

/** The event with this slug. Cached, so the page's metadata and the page share one read. */
export const getEventBySlug = cache(async (slug: string): Promise<EventDetails | null> => {
  const { data } = await supabaseAdmin.from("events").select("*").eq("slug", slug).maybeSingle();
  return (data as EventDetails | null) ?? null;
});

/** The fields of an event its invitation shows. */
function invitationEvent(event: EventDetails): InvitationEvent {
  return {
    event_type: event.event_type,
    title: event.title,
    hosted_by: event.hosted_by,
    event_date: event.event_date,
    start_time: event.start_time,
    end_time: event.end_time,
    time_zone: event.time_zone,
    location_name: event.location_name,
    location_address: event.location_address,
    message: event.message,
    image_url: event.image_url,
    rsvp_by: event.rsvp_by,
    gift_note: event.gift_note,
    theme_color: event.theme_color,
  };
}

type InvitationGuest = Pick<
  EventGuest,
  | "id"
  | "name"
  | "email"
  | "rsvp_status"
  | "party_size"
  | "kids_count"
  | "rsvp_note"
  | "token"
  | "in_exchange"
  | "wishlist_url"
  | "gift_ideas"
  | "shipping_address"
  | "giftee_id"
  | "answers"
>;

/**
 * The invitation for the event with this slug, as the viewer sees it. `token`
 * is the guest's own RSVP token from their link (`?g=`), or null for the plain
 * event link. Null when there's no such event.
 */
export async function loadInvitationPage(slug: string, token: string | null): Promise<InvitationPageData | null> {
  const [event, viewer] = await Promise.all([getEventBySlug(slug), getViewer()]);
  if (!event) return null;

  const [registries, exchange, signupSheet, updates, guestResult] = await Promise.all([
    getEventRegistries(event.id, { withItems: true }),
    getGiftExchange(event.id),
    getSignupSheet(event.id),
    // The host's messages and changes, for anyone with the link (#129).
    getInvitationUpdates(event.id),
    token
      ? supabaseAdmin
          .from("event_guests")
          .select(
            "id, name, email, rsvp_status, party_size, kids_count, rsvp_note, token, in_exchange, wishlist_url, gift_ideas, shipping_address, giftee_id, answers",
          )
          .eq("event_id", event.id)
          .eq("token", token)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const guest = guestResult.data as InvitationGuest | null;

  // Group gifts started from this event, on a guest's own link only. Gifts
  // for lists the guest manages stay hidden, so their surprise holds.
  const groupGifts = guest
    ? await listsOfViewer(
        registries.map((r) => r.id),
        { viewerId: viewer?.id ?? null, guestEmail: guest.email },
      )
        .then((own) => groupGiftsForEvent(event.id, { hideRegistryIds: own }))
        .catch((err) => {
          console.error("[event] Failed to load group gifts:", err);
          return [];
        })
    : [];

  // Who this guest drew, once names are drawn. Only their own link shows it.
  const giftee = exchange?.drawn_at && guest ? await getGifteeFor(event.id, guest.giftee_id) : null;
  const gifteeWishlistSlug = giftee?.wishlistUrl ? registrySlugFromLink(giftee.wishlistUrl) : null;
  const gifteeWishlistHref = giftee?.wishlistUrl
    ? giftee.wishlistTitle && gifteeWishlistSlug && guest
      ? `/e/${event.slug}/gifts?g=${encodeURIComponent(guest.token)}&to=${encodeURIComponent(gifteeWishlistSlug)}`
      : giftee.wishlistUrl
    : null;

  // Everyone gives everyone: the event's guests and hosts see everyone's
  // wishlists. A signed-in guest can pick one of their own lists after they
  // RSVP. Private lists are left out, since nobody else can open them.
  const everyone = exchangeKind(exchange) === "everyone";
  const [isHost, guestLists, waiting, myLists] = everyone
    ? await Promise.all([
        viewer ? getEventForManager(event.id, viewer.id).then(Boolean) : false,
        // A list the host linked that belongs to a guest without a wishlist
        // is theirs, on their row and in their wishlist step.
        getGuestWishLists(event.id, guest?.id ?? null).then((lists) => withGuestsLinkedLists(lists, registries)),
        supabaseAdmin
          .from("event_guests")
          .select("id", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("rsvp_status", "pending")
          .then(({ count }) => count ?? 0),
        viewer
          ? supabaseAdmin
              .from("registries")
              .select("id, title, slug")
              .eq("owner_id", viewer.id)
              .eq("is_private", false)
              .order("created_at", { ascending: false })
              .then(({ data }) => (data || []) as { id: string; title: string; slug: string }[])
          : [],
      ])
    : [false, [], 0, []];
  const showGuestLists = everyone && (Boolean(guest) || isHost);
  // Everyone gives everyone: each list the host linked shows whose it is,
  // like a guest's. Its owner sees their own name. Anyone else sees the
  // owner's name only when the list's own page shows it (on their profile,
  // and they haven't blocked the viewer), or else the names written on the
  // list. The owner's id and account name stay on the server.
  // Only the fields the invitation shows: not who linked the list.
  const invitationRegistries: InvitationRegistry[] = await Promise.all(
    registries.map(async ({ owner, id, title, slug, honoree, items, itemsLeft }) => {
      const list: InvitationRegistry = {
        id,
        title,
        slug,
        honoree,
        items: items?.map((item) => ({ id: item.id, title: item.title, image_url: item.image_url, price: item.price })),
        itemsLeft,
      };
      if (!everyone || !owner) return list;
      const isYours = viewer?.id === owner.id;
      const named = isYours
        ? owner.accountName
        : owner.name && !(await getViewerRelation(owner.id)).hidden
          ? owner.name
          : null;
      return { ...list, ownerName: named ?? list.honoree, isYours };
    }),
  );
  // The guest's own wishlist, for the step after their RSVP: the one they
  // added, or else their own list the host linked.
  const ownEntry = guestLists.find((entry) => entry.isYou) ?? null;
  const ownList = ownEntry?.registry ? myLists.find((list) => list.slug === ownEntry.registry!.slug) : undefined;
  const ownUrl = guest?.wishlist_url || ownEntry?.url || null;
  // A signed-in guest or host gets a Follow button beside each other guest
  // who has an account they may be shown (src/lib/guest-follow-rules.ts).
  // The guests' emails and account ids are read here and stay on the server.
  const guestFollows =
    showGuestLists && viewer && guestLists.some((entry) => !entry.isYou)
      ? await supabaseAdmin
          .from("event_guests")
          .select("id, email, profile_id")
          .eq("event_id", event.id)
          .eq("in_exchange", true)
          .then(({ data }) =>
            guestFollowsFor(
              viewer.id,
              ((data || []) as { id: string; email: string | null; profile_id: string | null }[]).filter(
                (row) => row.id !== guest?.id,
              ),
              "guest",
            ),
          )
      : null;
  // Their row in everyone's wishlists opens their own page for that list.
  // Only a list their account owns: the owner's page hides what the list
  // hides from its owner, and a co-manager's shows everything.
  // The same goes for their other lists, like one they keep for their child.
  const ownMore = (ownEntry?.more ?? []).map((list) => ({
    ...list,
    ownListId: myLists.find((mine) => mine.slug === list.slug)?.id ?? null,
  }));
  const wishLists = guestLists.map((entry) => ({
    ...entry,
    ...(ownList && entry === ownEntry ? { ownListId: ownList.id } : {}),
    ...(entry === ownEntry && ownMore.length > 0 ? { more: ownMore } : {}),
    ...(guestFollows?.has(entry.guestId) ? { follow: guestFollows.get(entry.guestId) } : {}),
  }));
  const wishlist: RsvpWishlistData | null = everyone
    ? {
        current: ownUrl
          ? { url: ownUrl, title: ownEntry?.registry?.title ?? null, ownListId: ownList?.id ?? null }
          : null,
        giftIdeas: guest?.gift_ideas ?? null,
        more: ownMore.flatMap(({ id, title, ownListId }) => (id ? [{ id, title, ownListId }] : [])),
        account: viewer ? { lists: myLists.map(({ id, title }) => ({ id, title })) } : null,
        themeColor: event.theme_color ?? null,
      }
    : null;
  // The event's own time zone could be a day behind UTC, so it counts as over
  // only once yesterday in UTC is past it. Sign-up days work the same way.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const signupRows = signupSheet ? signupRowsForGuest(signupSheet, guest?.id ?? null, yesterday) : [];
  // A meal train's drop-off address shows only to guests who signed up for a day.
  const signedUp = signupRows.some((row) => row.mine);
  const shown = withAddressFor(event, signedUp);
  const addressHidden = shown !== event && Boolean(event.location_name || event.location_address);
  const mealTrain = hidesAddressUntilSignup(event.event_type);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const eventUrl = `${siteUrl}/e/${event.slug}`;
  // The .ics file has no guest, so it never has a meal train's address.
  const google = googleCalendarUrl(shown, eventUrl);

  return {
    slug: event.slug,
    event: invitationEvent(shown),
    registries: invitationRegistries,
    exchange: exchange
      ? {
          kind: exchange.kind,
          budget: exchange.budget,
          draw_by: exchange.draw_by,
          mailed: exchange.mailed,
          drawn_at: exchange.drawn_at,
        }
      : null,
    wishLists: showGuestLists ? { lists: wishLists, waitingCount: waiting } : null,
    guestToken: guest?.token ?? null,
    staleToken: Boolean(token) && !guest,
    calendar: google ? { google, ics: `/e/${event.slug}/calendar` } : null,
    signup: signupSheet
      ? { title: signupSheet.sheet.title, note: signupSheet.sheet.note, rows: signupRows, mealTrain }
      : null,
    addressHidden,
    updates,
    santa:
      giftee && exchange
        ? { giftee, budget: exchange.budget, mailed: exchange.mailed, wishlistHref: gifteeWishlistHref }
        : null,
    rsvp: {
      guest: guest
        ? {
            name: guest.name,
            status: guest.rsvp_status,
            partySize: guest.party_size,
            kidsCount: guest.kids_count,
            note: guest.rsvp_note,
            inExchange: guest.in_exchange,
            wishlistUrl: guest.wishlist_url,
            giftIdeas: guest.gift_ideas,
            shippingAddress: guest.shipping_address,
            answers: storedAnswers(guest.answers),
          }
        : null,
      openRsvp: event.open_rsvp && !(exchange?.drawn_at && exchange.mailed),
      maxPartySize: event.max_party_size,
      askKids: event.ask_kids,
      exchange: exchange
        ? { kind: exchangeKind(exchange), mailed: exchange.mailed, drawn: Boolean(exchange.drawn_at) }
        : null,
      wishlist,
      passed: eventHasPassed(event, yesterday),
      signup: signupSheet ? { title: signupSheet.sheet.title, rows: signupRows } : null,
      mealTrain,
      questions: storedQuestions(event.rsvp_questions),
    },
    groupGifts,
  };
}
