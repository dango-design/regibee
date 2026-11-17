// What the event pages show, as src/lib/events-page.ts loads them for the
// website and the phone app. Only types, and only relative type imports of
// shareable files, so the app can share it through @shared/*.

import type { EventDetails, EventGuest, EventType, ExchangeStatus, GiftExchange, RsvpSummary } from "./events";
import type { EventMessage, MessageAudience } from "./event-updates";
import type { GroupEvent, GroupSummary } from "./groups";
import type { RsvpQuestion } from "./rsvp-questions";
import type { HostSignupRow, SignupSheet } from "./signups";

/** An event's card on the Events tab. */
export interface EventsTabCard {
  id: string;
  slug: string;
  title: string;
  eventType: EventType;
  eventDate: string | null;
  /** "6:00 PM PT", or null without a time. */
  time: string | null;
  imageUrl: string | null;
  summary: RsvpSummary;
  /** Someone else made it; the viewer co-hosts it. */
  coHost: boolean;
}

export interface EventsTabData {
  /** Soonest first, with no-date events last. */
  upcoming: EventsTabCard[];
  /** Most recent first. */
  past: EventsTabCard[];
  /** "Celebrating you": other people's upcoming events that link the viewer's lists. */
  linked: { id: string; slug: string; title: string; dateText: string | null; registryTitles: string[] }[];
  groups: GroupSummary[];
  /** YYYY-MM-DD in UTC. */
  today: string;
}

/** The owner and co-hosts, owner first (getEventHosts in src/lib/events-server.ts). */
export interface EventPageHost {
  userId: string;
  name: string;
  isOwner: boolean;
}

/** A co-host invitation that hasn't expired. */
export interface EventPageHostInvite {
  id: string;
  email: string | null;
  token: string;
  expires_at: string;
}

export interface EventPageData {
  event: EventDetails & { remind_day_before?: boolean | null; rsvp_questions?: unknown };
  /** The viewer made the event. Co-hosts can do almost everything else. */
  isOwner: boolean;
  viewerId: string;
  /** Where guests' replies to invitations go. */
  replyToEmail: string | null;
  /** Without who drew whom, or what guests told only their Secret Santa. */
  guests: EventGuest[];
  registries: { id: string; slug: string; title: string; honoree: string | null }[];
  exchange: GiftExchange | null;
  exchangeStatus: ExchangeStatus | null;
  exclusions: { guest_a: string; guest_b: string }[];
  hosts: EventPageHost[];
  invites: EventPageHostInvite[];
  /** Other events with guests, for "Copy guests from another event". */
  copySources: { id: string; title: string; guestCount: number }[];
  groups: GroupSummary[];
  /** People asked to make a list for the event who haven't yet. */
  listRequests: { name: string; email: string }[];
  signupSheet: { sheet: SignupSheet; rows: HostSignupRow[] } | null;
  /** What each guest signed up for, by guest id. */
  signupsByGuest?: Record<string, string[]>;
  /** A meal train hides the drop-off address until someone signs up. */
  mealTrain: boolean;
  questions: RsvpQuestion[];
  /** How many guests with an email each "Message guests" choice reaches. */
  audienceCounts: Record<MessageAudience, number>;
  /** The newest messages to guests. */
  messages: EventMessage[];
  time: string | null;
  typeLabel: string;
}

export interface EventFormData {
  /** Lists the viewer owns or manages, to link. */
  registries: { id: string; title: string }[];
  /** The event being edited, or null for a new one. */
  event: (EventDetails & { remind_day_before?: boolean | null; rsvp_questions?: unknown }) | null;
  linkedRegistries: { id: string; title: string; honoree: string | null }[];
  exchange: GiftExchange | null;
}

export interface PlanPickerData {
  /** The viewer's first name, for suggested titles. */
  myName: string;
  myLists: { id: string; title: string }[];
}

export interface GroupPageData {
  group: { id: string; name: string };
  members: { id: string; name: string; email: string | null }[];
  events: GroupEvent[];
  sharedLists: { id: string; slug: string; title: string }[];
}
