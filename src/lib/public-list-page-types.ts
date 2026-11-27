// What a list's public page loads (loadPublicList in
// src/lib/public-list-page.ts): the website's page at /r/<slug> and the phone
// app's list screen both show this.
//
// The phone app imports this file too, so it imports only other shared
// files, with relative paths, and nothing that runs on a server.

import type { GiftProfile } from "./gift-profile";
import type { FundsPosition, MyItemGift } from "./gifts";
import type { StoreId } from "./retailers";
import type { ListEventForViewer } from "./shared-events";
import type { PaymentMethods, RegistryType } from "./types";

/** An item as guests see it. */
export interface PublicListItem {
  id: string;
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
}

export interface PublicListCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface PublicListFund {
  id: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  current_amount: number;
}

/** What the Follow button shows for the list's owner (FollowButtonState on the website). */
export type PublicListFollowState = "signed-out" | "none" | "pending" | "approved" | "blocked";

/**
 * A guest's own gifts, as the website's `regibee_my_gifts` cookie holds them:
 * purchase ids by item id, and amounts given by gift fund id. A signed buyer
 * link adds "reserved" for an item. Gifts saved before the cookie held
 * purchase ids say "cover" for an item the owners bought themselves.
 */
export interface GuestGifts {
  items?: Record<string, string>;
  funds?: Record<string, number>;
}

/** A guest from an event's gift link: their name and email start filled in. */
export interface PublicListPrefill {
  name: string;
  email: string | null;
  /** The guest is the Secret Santa of this list's owner, so the owners see "Secret Santa" instead of their name. */
  secretGiver?: boolean;
}

/** Everything the list's public page shows. */
export interface PublicListPageData {
  registry: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    photo_url: string | null;
    event_date: string | null;
    honoree_names: string | null;
    parent_names: string | null;
    registry_type: RegistryType;
  };
  /**
   * The band's color and pattern the owner chose, or null when they never
   * chose. Read it with listHeader (src/lib/list-headers.ts).
   */
  header?: { color: string; pattern: string } | null;
  /** Who shared the list, when it's on their profile and they haven't blocked the viewer. */
  owner: { publicId: string; path: string; name: string } | null;
  /** How the viewer relates to the owner. Set whenever `owner` is. */
  ownerRelation: { state: PublicListFollowState; isOwner: boolean; followsYou: boolean } | null;
  /** The viewer is signed in. */
  signedIn: boolean;
  /** The viewer owns or co-manages the list. */
  viewerManages: boolean;
  /** Whose list it is, for sentences such as "Ship it to Sam". */
  parentName: string;
  /** Whose gift profile it is, as in "About Dorothy". */
  giftProfileName: string;
  /** The tag on an item the owners bought themselves: "Already bought". */
  selfPurchasedLabel: string;
  /** What the cover dialog says about giving money for an item the owners bought. */
  coverFlavor: string;
  /** The person's sizes and likes, as far as the viewer may see them. Wishlists only. */
  giftProfile: GiftProfile | null;
  showBirthday: boolean;
  /** The owner is looking and hides what's been reserved from themselves, so nothing shows as reserved. */
  hideReservations: boolean;
  /** A gift exchange turned that on, not the owner. */
  hiddenByExchange: boolean;
  categories: PublicListCategory[];
  items: PublicListItem[];
  cashFunds: PublicListFund[];
  /** Whether the funds go above the items or after them. Older loaders sent none: read it as "top". */
  fundsPosition?: FundsPosition;
  paymentMethods: PaymentMethods | null;
  /** Only for a guest with a live reservation on this list. */
  shippingAddress: string | null;
  /** Stores where the owner has their own registry. Ids only: guests never get the links. */
  linkedStores: StoreId[];
  /** Tell guests when a gift is on the owner's store registry. Baby registries only. */
  showStoreRegistries: boolean;
  /** The guest's gifts on this list, as the cookie holds them. */
  myGifts: GuestGifts;
  /** The guest's own gifts, by item id, matched to purchases on the server. */
  myItemGifts: Record<string, MyItemGift>;
  /** How many of each item other guests have reserved but not bought yet. */
  reservedCounts: Record<string, number>;
  /** How many of each item the owners bought have been covered by guests. */
  coverCounts: Record<string, number>;
  /**
   * For a guest of an everyone-gives-everyone event: who else from the event
   * reserved each item, so nobody doubles up.
   */
  fellowGuests: {
    claims: Record<string, string[]>;
    eventTitle: string;
    eventSlug: string;
    /** Whose list it is, to name in the notice. */
    ownerName: string | null;
  } | null;
  /** The events this list is on that the viewer and the owner are both invited to. */
  listEvents: ListEventForViewer[];
  /** The guest is this person's Secret Santa. */
  santaFor: string | null;
  /** A guest from an event's gift link. */
  guestPrefill: PublicListPrefill | null;
  /** Group gifts. Null for the list's own managers, who only ever see an ordinary reservation. */
  groupGifts: {
    /** The viewer's own group gifts, by item id. */
    mine: Record<string, { token: string; organizer: boolean }>;
    /** The event the viewer came from, whose guests will see a new group gift. */
    eventTitle: string | null;
  } | null;
  /**
   * How many items are gifted. An item the owners bought counts only once
   * guests cover it or the owners mark it as gifted (src/lib/gifts.ts).
   */
  fulfilledItems: number;
  totalItems: number;
}
