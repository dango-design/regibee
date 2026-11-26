// What an event's invitation page loads (loadInvitationPage in
// src/lib/invitation-page.ts): the website's page at /e/<slug> and the phone
// app's invitation screen both show this.
//
// The phone app imports this file too, so it imports only other shared
// files, with relative paths, and nothing that runs on a server.

import type { EventDetails, ExchangeGiftee, ExchangeKind, GiftExchange, GuestWishList, LinkedRegistry, RsvpStatus } from "./events";
import type { InvitationUpdate } from "./event-updates";
import type { EventGroupGift } from "./group-gifts";
import type { RsvpAnswers, RsvpQuestion } from "./rsvp-questions";
import type { GuestSignupRow } from "./signups";

/**
 * The event as its invitation shows it. Only these fields leave the server:
 * not the owner, the guest list or the host's email settings.
 */
export type InvitationEvent = Pick<
  EventDetails,
  | "event_type"
  | "title"
  | "hosted_by"
  | "event_date"
  | "start_time"
  | "end_time"
  | "time_zone"
  | "location_name"
  | "location_address"
  | "message"
  | "image_url"
  | "rsvp_by"
> &
  Partial<Pick<EventDetails, "gift_note" | "theme_color">>;

/** A registry linked to the event, as the invitation shows it. */
export interface InvitationRegistry extends LinkedRegistry {
  /** Whose list it is: "Remi & Max". */
  honoree?: string | null;
  /** A few gifts still needed. The invitation shows up to three of their pictures. */
  items?: { id: string; title: string; image_url: string | null; price: number | null }[];
  /** How many items still need a giver. */
  itemsLeft?: number;
  /**
   * Everyone gives everyone: whose list it is, to show it like a guest's.
   * Their account name, or the names written on the list.
   */
  ownerName?: string | null;
  /**
   * The viewer owns this list. Nobody shops their own list, so its button
   * opens the viewer's own page for it instead, by `id`.
   */
  isYours?: boolean;
  /** The list's id. Your own list opens on your own page for it, by its id. */
  id?: string;
}

/** A sign-up sheet as the invitation shows it. */
export interface InvitationSignup {
  title: string;
  note: string | null;
  rows: GuestSignupRow[];
  /** A meal train: guests pick a day to help instead of coming to something. */
  mealTrain?: boolean;
}

/** The guest on a personal RSVP link, as the RSVP form shows them. */
export interface RsvpGuest {
  name: string;
  status: RsvpStatus;
  partySize: number;
  note: string | null;
  kidsCount?: number;
  inExchange?: boolean;
  wishlistUrl?: string | null;
  giftIdeas?: string | null;
  shippingAddress?: string | null;
  /** Their answers to the host's questions. */
  answers?: RsvpAnswers;
}

/** What the wishlist step after an RSVP needs, on an everyone-gives-everyone event. */
export interface RsvpWishlistData {
  /**
   * The guest's wishlist now, or null. A Regibee list has its title, and its
   * id when it's one of the signed-in account's own lists, so they can add to it.
   */
  current: { url: string; title: string | null; ownListId: string | null } | null;
  giftIdeas: string | null;
  /**
   * More of the guest's own lists on the event, besides their wishlist, like
   * one they keep for their child. Each has its id when their account owns it.
   */
  more?: { id: string; title: string; ownListId: string | null }[];
  /** The signed-in account's own lists that others can open. Null when signed out. */
  account: { lists: { id: string; title: string }[] } | null;
  /** The host's color for the invitation, which fills the step. None leaves it without a fill. */
  themeColor?: string | null;
}

/** What the RSVP form needs. */
export interface InvitationRsvp {
  /** The guest from a personal link, or null for someone on the plain event link. */
  guest: RsvpGuest | null;
  /** Whether people without a personal link can RSVP. */
  openRsvp: boolean;
  maxPartySize: number;
  /** Ask how many of the party are kids. */
  askKids: boolean;
  /** The event's gift exchange, when it has one. */
  exchange: { kind: ExchangeKind; mailed: boolean; drawn: boolean } | null;
  /** Everyone gives everyone: the guest's wishlist, for the step after they RSVP. */
  wishlist: RsvpWishlistData | null;
  /** The event's day is over. */
  passed: boolean;
  /** The event's sign-up sheet, as this guest sees it. Guests pick rows in the form. */
  signup: { title: string; rows: GuestSignupRow[] } | null;
  /** A meal train: guests say whether they can help and pick days, with no party size. */
  mealTrain: boolean;
  /** What the host asks besides how many are coming. */
  questions: RsvpQuestion[];
}

export interface InvitationPageData {
  slug: string;
  event: InvitationEvent;
  /** The registries the event links, in order. */
  registries: InvitationRegistry[];
  exchange: Pick<GiftExchange, "kind" | "budget" | "draw_by" | "mailed" | "drawn_at"> | null;
  /**
   * Everyone gives everyone: each guest's wishlist, for the event's guests
   * and hosts only. Null for anyone else, who sees only the host's lists.
   */
  wishLists: { lists: GuestWishList[]; waitingCount: number } | null;
  /** The guest's own RSVP token, when the link had one that's still on the guest list. */
  guestToken: string | null;
  /** The link had a token that's no longer on the guest list. */
  staleToken: boolean;
  /**
   * Add-to-calendar links, when the event has a date. `ics` is a path on the
   * website, such as "/e/<slug>/calendar".
   */
  calendar: { google: string; ics: string } | null;
  signup: InvitationSignup | null;
  /** A meal train's drop-off address, held back until the guest signs up. */
  addressHidden: boolean;
  /** The host's messages and changes to the date, time or place, newest first. */
  updates: InvitationUpdate[];
  /**
   * Who this guest drew in the gift exchange, on their own link once names
   * are drawn. `wishlistHref` is a path on the website for a Regibee
   * wishlist (through the event, so gifts stay secret), or any store's link.
   */
  santa: { giftee: ExchangeGiftee; budget: string | null; mailed: boolean; wishlistHref: string | null } | null;
  rsvp: InvitationRsvp;
  /** Group gifts started from this event, on a guest's own link only. */
  groupGifts: EventGroupGift[];
}

/**
 * A gift link on the invitation. With the guest's token it goes through the
 * event (/e/<event>/gifts), which tells the list who the guest is, so a gift
 * is matched to their RSVP.
 */
export function invitationGiftPath(eventSlug: string, guestToken: string | null | undefined, listSlug: string): string {
  return guestToken
    ? `/e/${eventSlug}/gifts?g=${encodeURIComponent(guestToken)}&to=${encodeURIComponent(listSlug)}`
    : `/r/${listSlug}`;
}
