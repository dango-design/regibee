// The events a profile shows its viewer under "Events together": the ones
// both the viewer and the profile's person went to, or are going to.
//
// Someone goes to an event when they host or co-host it, or when they're on
// its guest list and replied yes. An invitation alone doesn't count, and
// neither does "maybe" or "no": a guest's reply is otherwise shown only to
// the hosts, so the profile gives away no more than seeing each other there
// would.
//
// A list's page uses a looser rule for the events the list is on: both the
// visitor and the list's owner are invited, and neither said no (`invited`).
// The visitor already sees those events and their lists on their own
// invitation, so the page only adds that the owner hasn't said no.
//
// This file imports only a type, so the server and tests can both use it.
// The reads are in src/lib/shared-events-server.ts.

import type { EventType } from "./events";

/** How one person is on an event: a host, or a guest with this reply. */
export type EventPart = "host" | "yes" | "no" | "maybe" | "pending";

/** One person's guest row on an event. */
export interface PartGuestRow {
  event_id: string;
  rsvp_status: "yes" | "no" | "maybe" | "pending";
  token: string;
}

/** How one person is on each of their events, by event id. */
export interface EventParts {
  parts: Map<string, EventPart>;
  /** Their guest link token on each event where they have a guest row. */
  tokens: Map<string, string>;
}

/**
 * One person's part in each event they host or are a guest at. Hosting wins
 * over a guest row on the same event. `guests` lists rows linked to the
 * account first, so those win over rows matched by email.
 */
export function eventParts(hostedEventIds: string[], guests: PartGuestRow[]): EventParts {
  const parts = new Map<string, EventPart>();
  const tokens = new Map<string, string>();
  for (const row of guests) {
    if (parts.has(row.event_id)) continue;
    parts.set(row.event_id, row.rsvp_status);
    tokens.set(row.event_id, row.token);
  }
  for (const id of hostedEventIds) parts.set(id, "host");
  return { parts, tokens };
}

/** Whether this part means the person went, or is going. */
export function goes(part: EventPart | undefined): boolean {
  return part === "host" || part === "yes";
}

/** Ids of the events both people went to or are going to. */
export function sharedEventIds(viewer: EventParts, person: EventParts): string[] {
  return [...viewer.parts.keys()].filter((id) => goes(viewer.parts.get(id)) && goes(person.parts.get(id)));
}

/** A shared event, as the profile shows it. */
export interface SharedEvent {
  id: string;
  title: string;
  eventType: EventType;
  /** YYYY-MM-DD, or null when the event has no date yet. */
  eventDate: string | null;
  /** "6:00 PM PT", or null without a time. */
  time: string | null;
  /** Where the viewer opens it: the event's page for a host, their own guest link for a guest. */
  href: string;
}

/**
 * Today's and later events first, soonest first, then events with no date,
 * then past events, most recent first.
 */
export function sortSharedEvents<T extends Pick<SharedEvent, "eventDate">>(events: T[], today: string): T[] {
  const rank = (event: T) => (event.eventDate === null ? 1 : event.eventDate < today ? 2 : 0);
  return [...events].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.eventDate === null || b.eventDate === null) return 0;
    return rank(a) === 2 ? b.eventDate.localeCompare(a.eventDate) : a.eventDate.localeCompare(b.eventDate);
  });
}

/**
 * Whether this part means the person is invited and hasn't said no: a host,
 * or a guest whose reply is yes, maybe or not in yet. A list's page shows a
 * signed-in visitor the events the list is on only when both the visitor and
 * the list's owner are invited (listEventsOnListForViewer).
 */
export function invited(part: EventPart | undefined): boolean {
  return part !== undefined && part !== "no";
}

/** Of `eventIds`, the ones both people are invited to and haven't said no to. */
export function eventIdsBothInvited(eventIds: Iterable<string>, viewer: EventParts, person: EventParts): string[] {
  return [...new Set(eventIds)].filter((id) => invited(viewer.parts.get(id)) && invited(person.parts.get(id)));
}

/** An event a list is on, as the list's page shows it to a visitor invited to it. */
export interface ListEventForViewer extends SharedEvent {
  /** The visitor's own part: how they're on the event. Never "no". */
  part: Exclude<EventPart, "no">;
}
