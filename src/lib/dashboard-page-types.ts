// What the My registries tab shows, as src/lib/dashboard-page.ts loads it for
// the website's page and the phone app. Only types, and only relative type
// imports of shareable files, so the app can share it through @shared/*.

import type { PersonalEventType, RegistryType } from "./types";

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
  fulfilledItems: number;
  totalValue: number;
  /** The newest three gifts: "Ana reserved an item". Empty while reservations are hidden. */
  recentActivity: { id: string; name: string; action: string }[];
  /** The owner hides what's been reserved from themselves. */
  reservationsHidden: boolean;
}

export interface DashboardData {
  /** The user's own lists, newest first. */
  owned: DashboardCard[];
  /** Lists they help manage, newest first. */
  shared: DashboardCard[];
  /** Gifts reserved in the last 7 days, an item on several lists counted once. */
  giftsThisWeek: number;
  /** People waiting for the user to approve their follow. */
  followRequestCount: number;
  /** None of their lists is on their profile yet. */
  showProfilePrompt: boolean;
  /** YYYY-MM-DD in UTC, for the cards' countdowns. */
  today: string;
}
