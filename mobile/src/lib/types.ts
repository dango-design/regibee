// The rows the app reads, matching the website's src/lib/types.ts and the
// tables in supabase/migrations. Screens that the website's server loads come
// with the website's own types (@shared/*-types).

import type { DashboardCard } from "@shared/dashboard-page-types";
import type { ListPageEvent, ListPageSuggestion } from "@shared/list-page-types";
import type { ListOccasion } from "@shared/occasions";
import type { RetailerRegistry, StoreId } from "@shared/retailers";
import type { StorePerksRow } from "@shared/store-perks";

export type RegistryType = "baby" | "personal";
export type EventType = ListOccasion;

export interface Registry {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  event_date: string | null;
  is_public: boolean;
  /** Only the owner and co-managers can open it. Missing in the demo. */
  is_private?: boolean;
  /** Shown on the owner's profile. */
  listed_on_profile?: boolean;
  description: string | null;
  photo_url: string | null;
  registry_type: RegistryType | null;
  event_type: EventType | null;
  honoree_names: string | null;
  /**
   * The registry's settings: payment methods, zip code, store registries,
   * "Hide what's been reserved from me" and the rest. Read them with the
   * website's helpers, such as reservationsHiddenFrom (src/lib/gifts.ts).
   */
  settings?: Record<string, unknown> | null;
  created_at: string;
}

export interface Category {
  id: string;
  registry_id: string;
  name: string;
  sort_order: number;
}

export interface Item {
  id: string;
  /** The list it's shown on. For an item placed from another list, this list. */
  registry_id: string;
  /** Its category on this list. */
  category_id: string | null;
  title: string;
  external_url: string | null;
  image_url: string | null;
  price: number | null;
  quantity_needed: number;
  quantity_fulfilled: number;
  /** "Most wanted" on the website. */
  is_essential: boolean;
  /** "I bought it myself": guests can still give it by sending the money. */
  is_parent_purchased: boolean;
  is_open_to_used: boolean;
  minimum_condition: UsedCondition | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  /**
   * Guests' gifts of this item, newest first, cancelled ones included.
   * Reserving raises quantity_fulfilled, so these tell an open hold from a
   * gift that was given.
   */
  purchases: ItemGift[];
  /** The titles of the owner's other lists this item is on (src/lib/list-items.ts). */
  otherLists?: string[];
  /** It's on this list through a placement from another of the owner's lists. */
  placed?: boolean;
}

/** A gift as an item's row reads it. */
export type ItemGift = Pick<Gift, "id" | "status" | "reserved_until" | "buyer_name" | "quantity"> &
  Partial<Pick<Gift, "created_at" | "hide_giver" | "message" | "buyer_email" | "amount">>;

export interface CashFund {
  id: string;
  registry_id: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  current_amount: number;
}

export type PurchaseStatus = "reserved" | "purchased" | "cancelled";

export interface Gift {
  id: string;
  buyer_name: string;
  buyer_email: string | null;
  quantity: number;
  amount: number | null;
  status: PurchaseStatus;
  /**
   * When a guest's hold on the item runs out, while they still have to buy it.
   * Null for gifts given before holds existed, which count as given. Read it
   * with isOpenReservation (src/lib/gifts.ts).
   */
  reserved_until: string | null;
  message: string | null;
  created_at: string;
  registry_item_id: string | null;
  cash_fund_id: string | null;
  /** The item's or fund's title. */
  for_title: string;
  kind: "item" | "fund";
  /** The item's price, shown beside an item gift as on the website. */
  item_price?: number | null;
  /** The owner bought the item, so this gift is money toward it ("Covered by guest"). */
  item_bought_by_owner?: boolean;
  /**
   * A Secret Santa's gift. The server already swaps the name for "Secret
   * Santa" and removes the email, so owners never see who gave it.
   */
  hide_giver?: boolean;
}

/** The lowest condition an owner will take a hand-me-down in, as the website offers them (src/lib/extension.ts). */
export const USED_CONDITIONS = [
  { id: "like-new", label: "Like new" },
  { id: "very-good", label: "Very good" },
  { id: "good", label: "Good" },
  { id: "acceptable", label: "Acceptable" },
] as const;

export type UsedCondition = (typeof USED_CONDITIONS)[number]["id"];

/** A list's card on the home screen, as the website's My registries tab loads it. */
export type RegistrySummary = DashboardCard;

export type Suggestion = ListPageSuggestion;

/** A list's screen, as the website's list page loads it (src/lib/list-page.ts). */
export interface RegistryDetail {
  registry: Registry;
  role: "owner" | "manager";
  categories: Category[];
  items: Item[];
  funds: CashFund[];
  /** Gift Activity, newest first. Cancelled gifts stay, faded, as on the website. */
  gifts: Gift[];
  suggestions: Suggestion[];
  pendingSuggestions: number;
  /**
   * The owner hides what's been reserved from themselves. Then items, funds
   * and gifts show only the gifts revealed the day after an event the list
   * is linked to, and nothing else.
   */
  reservationsHidden: boolean;
  /** With reservations hidden: how many gifts have been revealed. */
  revealedCount?: number;
  /** With reservations hidden: when the next event's gifts are revealed. */
  nextReveal?: { date: string; eventTitle: string } | null;
  /** A gift exchange turned "Hide what's been reserved" on. */
  turnedOnByExchange: boolean;
  /** Events that link this list. */
  linkedEvents: ListPageEvent[];
  /** Baby lists have the checklist. */
  showChecklist: boolean;
  checklistProgress: { matched: number; total: number };
  /** The owner's store registries, for baby lists. Null on other lists. */
  linkedRegistries: RetailerRegistry[] | null;
  /** Stores with a registry link on any item. */
  registryLinkStores: StoreId[];
  /** Items with a plain link at a store where the owner has a registry. */
  plainLinkGroups: { storeId: StoreId; items: { id: string; title: string }[] }[];
  perkRows: StorePerksRow[];
  perkEmails: boolean;
  readyPerkCount: number;
  /** Set when the list adds estimated sales tax to what the owner bought. */
  zipCode: string | null;
  canPlanEvents: boolean;
  eventPromptDismissed: boolean;
  showPlanEventButton: boolean;
}

/** The fields of the add and edit item forms. */
export interface ItemInput {
  title: string;
  external_url: string | null;
  image_url: string | null;
  price: number | null;
  quantity_needed: number;
  category_id: string | null;
  is_essential: boolean;
  is_parent_purchased: boolean;
  is_open_to_used: boolean;
  minimum_condition: UsedCondition | null;
  notes: string | null;
  /** The product's barcode number, read from `external_url`. Only sent, never shown. */
  gtin?: string | null;
}
