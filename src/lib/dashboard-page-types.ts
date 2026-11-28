// What the My registries tab shows, as src/lib/dashboard-page.ts loads it for
// the website's page and the phone app. Only types, and only relative type
// imports of shareable files, so the app can share it through @shared/*.

import type { EventType, RsvpStatus, RsvpSummary } from "./events";
import type { ListProgress } from "./gifts";
import type { PersonalEventType, RegistryType } from "./types";

/** Someone else who manages a list: its owner or a co-manager. */
export interface DashboardManager {
  /** Their profile's name, or "Regibee member". */
  name: string;
  /** Their profile photo's URL, or null for their initials. */
  photoUrl: string | null;
}

/** One list's card. */
export interface DashboardCard {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  event_date: string | null;
  is_public: boolean;
  is_private: boolean;
  listed_on_profile: boolean;
  photo_url: string | null;
  registry_type: RegistryType;
  event_type: PersonalEventType | null;
  honoree_names: string | null;
  settings: Record<string, unknown> | null;
  created_at: string;
  /** "owner" for the user's own lists, "manager" for lists shared with them. */
  role: "owner" | "manager";
  totalItems: number;
  /**
   * How many items are gifted. An item a manager bought counts only once
   * guests cover it or they mark it as gifted (src/lib/gifts.ts).
   */
  fulfilledItems: number;
  /** Where each item stands. Missing from older servers' answers. */
  progress?: ListProgress;
  totalValue: number;
  /** The newest three gifts: "Ana reserved an item". Empty while reservations are hidden. */
  recentActivity: { id: string; name: string; action: string }[];
  /** Gifts reserved on this list in the last 7 days. 0 while reservations are hidden. */
  giftsThisWeek: number;
  /** The owner hides what's been reserved from themselves. */
  reservationsHidden: boolean;
  /**
   * Everyone else who manages the list, owner first. Empty when only the
   * viewer manages it. Missing from older servers' answers.
   */
  managers?: DashboardManager[];
}

/** An event in "Coming up" (src/lib/upcoming-events.ts). */
export interface DashboardEvent {
  id: string;
  slug: string;
  title: string;
  eventType: EventType;
  /** YYYY-MM-DD, today or later. */
  eventDate: string;
  /** "2 – 5 PM PDT", or null without a time. */
  time: string | null;
  /**
   * "host": the user hosts or co-hosts it, and it opens the event's page.
   * "guest": someone else hosts it and the user is on its guest list. It
   * opens the invitation on the user's own guest link.
   * "celebrating": someone else hosts it and it links one of the user's
   * lists, like a shower a friend is throwing. It opens the invitation.
   */
  role: "host" | "guest" | "celebrating";
  /** RSVPs so far. Only for events the user hosts. */
  summary: Pick<RsvpSummary, "guests" | "attending" | "maybe" | "pending"> | null;
  /** The user's own reply. Only for events they're a guest at. */
  rsvp?: RsvpStatus;
  /** The user's guest link token, for /e/<slug>?g=<token>. Only for events they're a guest at. */
  guestToken?: string;
}

export interface DashboardData {
  /** The user's own lists, newest first. */
  owned: DashboardCard[];
  /** Lists they help manage, newest first. */
  shared: DashboardCard[];
  /**
   * Every list they own or help manage, in the order they chose
   * (src/lib/list-order.ts). Missing from older servers' answers: then show
   * owned, then shared.
   */
  lists?: DashboardCard[];
  /** Gifts reserved in the last 7 days, an item on several lists counted once. */
  giftsThisWeek: number;
  /** People waiting for the user to approve their follow. */
  followRequestCount: number;
  /** None of their lists is on their profile yet. */
  showProfilePrompt: boolean;
  /**
   * "Coming up": the next few dated events from today on, soonest first, that
   * the user hosts, is invited to, or that celebrate them. Empty for guests.
   */
  upcomingEvents: DashboardEvent[];
  /** YYYY-MM-DD in UTC, for the cards' countdowns. */
  today: string;
}
