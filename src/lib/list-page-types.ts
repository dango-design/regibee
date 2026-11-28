// The data a list's manage page shows, as src/lib/list-page.ts loads it for
// the website's page and the phone app (src/app/api/app/data). Only types,
// and only relative imports of files without imports, so the app can share
// it through its @shared/* path.

import type { EventType } from "./events";
import type { DetailField, ShownSide } from "./item-details";
import type { RetailerRegistry, StoreId } from "./retailers";
import type { StorePerksRow } from "./store-perks";
import type { PersonalEventType, RegistryType } from "./types";

/** An event the list is on (listEventsForRegistry in src/lib/events-server.ts). */
export interface ListPageEvent {
  id: string;
  slug: string;
  title: string;
  event_date: string | null;
  event_type: EventType;
  /** Whether the viewer hosts it. Hosts open the event's dashboard; others see the guest page. */
  canManage: boolean;
  /**
   * True when a guest added the list as their wishlist and no host linked it.
   * It comes off on that guest's RSVP, so there's no Unlink button. Missing
   * from older servers' answers, which only listed linked events.
   */
  guestList?: boolean;
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
  /** For an item its managers bought: guests can cover it (src/lib/gifts.ts). Missing from older servers' answers. */
  guests_can_cover?: boolean;
  /** For an item its managers bought: they count it as gifted. Missing from older servers' answers. */
  marked_gifted?: boolean;
  is_open_to_used: boolean;
  minimum_condition: string | null;
  notes: string | null;
  category_id: string | null;
  sort_order: number;
  created_at: string;
  /**
   * The baby checklist entry it counts for: a key, "none", or null to match by
   * its title (src/lib/checklist-matching.ts). Missing before the
   * checklist_entries migration runs.
   */
  checklist_entry?: string | null;
  /** The list it was first saved to. */
  home_registry_id: string;
  /** It's on this list through a placement from another of the owner's lists. */
  placed: boolean;
  /** The titles of the owner's other lists it's on. */
  otherLists: string[];
  /** The ids of those lists. Missing from older servers' answers. */
  otherListIds?: string[];
  /**
   * Whether the list's page checks this item's price each week (src/lib/item-details.ts).
   * Missing when that doesn't apply: no link the extension reads, bought, or
   * never read by the extension. Also missing from older servers' answers.
   */
  priceChecks?: "on" | "off";
}

/** An item whose store link the extension can read again for its photo or price, or to check its price (src/lib/item-details.ts). */
export interface ListPageMissingDetails {
  id: string;
  title: string;
  external_url: string;
}

/** One change that filling in an item's details made. */
export interface ListPageDetailChange {
  field: DetailField;
  /** The value before. Null when the field was empty. */
  before: string | number | null;
  after: string | number;
  /** Which of the two the item shows now. */
  shown: ShownSide;
}

/** An item whose filled-in details nobody has reviewed yet. */
export interface ListPageDetailReview {
  itemId: string;
  title: string;
  imageUrl: string | null;
  changes: ListPageDetailChange[];
  /** True when a manager turned off this item's price checks ("Don't check this price again"). Missing from older servers' answers. */
  priceChecksOff?: boolean;
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
  /** Which baby checklist entry it counts for, as on items. */
  checklist_entry?: string | null;
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
  /**
   * The viewer's other lists, newest first, when the viewer owns this one.
   * They can add an item to one of them or move it there. Undefined for
   * co-managers.
   */
  ownerLists?: { id: string; title: string }[];
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
  /** The checklist's essentials done, of all of them. Missing from older servers' answers. */
  checklistEssentials?: { done: number; total: number };
  /** The owner's store registries, for baby lists. Undefined on other lists. */
  linkedRegistries?: RetailerRegistry[];
  storesWithRegistryLinks?: StoreId[];
  plainLinkGroups: { storeId: StoreId; items: { id: string; title: string }[] }[];
  /** Items the browser extension can fill in. Missing before the item_detail_reads migration runs. */
  missingDetails?: ListPageMissingDetails[];
  /** Items whose price the extension should check on this visit. Missing from older servers' answers. */
  priceChecks?: ListPageMissingDetails[];
  /** Filled-in details waiting for review. */
  detailReview?: ListPageDetailReview[];
  /**
   * Ids of the Elfster wishlists the browser extension should sync on this
   * visit (elfsterSyncsDue in src/lib/elfster-sync-server.ts). Never what's
   * been given on Elfster. Missing from older servers' answers and from the
   * support team's page.
   */
  elfsterSyncs?: string[];
  perkRows: StorePerksRow[];
  perkEmails: boolean;
  readyPerkCount: number;
  zipCode?: string;
  canPlanEvents: boolean;
  eventPromptDismissed: boolean;
  showPlanEventButton: boolean;
}

