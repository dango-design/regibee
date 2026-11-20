// The data a list's manage page shows, as src/lib/list-page.ts loads it for
// the website's page and the phone app (src/app/api/app/data). Only types,
// and only relative imports of files without imports, so the app can share
// it through its @shared/* path.

import type { EventType } from "./events";
import type { RetailerRegistry, StoreId } from "./retailers";
import type { StorePerksRow } from "./store-perks";
import type { PersonalEventType, RegistryType } from "./types";

/** An event that links the list (listEventsForRegistry in src/lib/events-server.ts). */
export interface ListPageEvent {
  id: string;
  slug: string;
  title: string;
  event_date: string | null;
  event_type: EventType;
  /** Whether the viewer hosts it. Hosts open the event's dashboard; others see the guest page. */
  canManage: boolean;
}

export interface ListPageItem {
  id: string;
  registry_id: string;
  title: string;
  external_url: string | null;
  image_url: string | null;
  price: number | null;
  quantity_needed: number;
  quantity_fulfilled: number;
  is_essential: boolean;
  is_parent_purchased: boolean;
  is_open_to_used: boolean;
  minimum_condition: string | null;
  notes: string | null;
  category_id: string | null;
  sort_order: number;
  created_at: string;
  /** The list it was first saved to. */
  home_registry_id: string;
  /** It's on this list through a placement from another of the owner's lists. */
  placed: boolean;
  /** The titles of the owner's other lists it's on. */
  otherLists: string[];
}

export interface ListPageCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface ListPageFund {
  id: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  current_amount: number;
}

/** A gift on the Gift Activity tab, with the giver masked for a Secret Santa. */
export interface ListPagePurchase {
  id: string;
  buyer_name: string;
  buyer_email: string | null;
  quantity: number;
  amount: number | null;
  status: "reserved" | "purchased" | "cancelled";
  reserved_until: string | null;
  message: string | null;
  created_at: string;
  registry_item_id: string | null;
  cash_fund_id: string | null;
  hide_giver?: boolean | null;
  item_title: string;
  registry_items: { title: string; registry_id: string; price: number | null; is_parent_purchased?: boolean } | null;
  cash_funds: { title: string; registry_id: string } | null;
  [key: string]: unknown;
}

export interface ListPageSuggestion {
  id: string;
  title: string;
  external_url: string | null;
  price: number | null;
  notes: string | null;
  suggested_by_name: string;
  suggested_by_email: string | null;
  status: "pending" | "offering" | "added" | "accepted" | "declined";
  created_at: string;
}

export interface ListPageData {
  registry: Record<string, any> & {
    id: string;
    owner_id: string;
    title: string;
    slug: string;
    event_date: string | null;
    registry_type: RegistryType;
    event_type: PersonalEventType | null;
    settings: Record<string, any> | null;
  };
  isOwner: boolean;
  categories: ListPageCategory[];
  items: ListPageItem[];
  funds: ListPageFund[];
  /** Gift Activity, newest first. Only revealed gifts when they're hidden from the owner. */
  purchases: ListPagePurchase[];
  suggestions: ListPageSuggestion[];
  pendingSuggestionCount: number;
  /** The owner hides what's been reserved from themselves (src/lib/gifts.ts). */
  hideReservations: boolean;
  turnedOnByExchange: boolean;
  revealInfo?: { revealedCount: number; next: { date: string; eventTitle: string } | null };
  linkedEvents: ListPageEvent[];
  showChecklist: boolean;
  checklistProgress: { matched: number; total: number };
  /** The owner's store registries, for baby lists. Undefined on other lists. */
  linkedRegistries?: RetailerRegistry[];
  storesWithRegistryLinks?: StoreId[];
  plainLinkGroups: { storeId: StoreId; items: { id: string; title: string }[] }[];
  perkRows: StorePerksRow[];
  perkEmails: boolean;
  readyPerkCount: number;
  zipCode?: string;
  canPlanEvents: boolean;
  eventPromptDismissed: boolean;
  showPlanEventButton: boolean;
}

