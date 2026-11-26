// What the Saved tab shows, as src/lib/saved-items.ts loads it for the
// website and the phone app. Only types, and only a relative type import of a
// shareable file, so the app can share it through @shared/*.

import type { PersonalEventType, RegistryType } from "./types";

export interface SavedList {
  id: string;
  title: string;
  registryType: RegistryType;
  eventType: PersonalEventType | null;
  /** "Wishlist", "Baby registry", "Birthday"… */
  kindLabel: string;
  /** The child's name, for a list kept for a child. */
  forChild: string | null;
  /**
   * The person's own wishlist: a personal list with no particular occasion,
   * not kept for a child. "Make just a wishlist" makes one.
   */
  isOwnWishlist: boolean;
  /** Whether the list hides what's been reserved from its owner. */
  hidesReservations: boolean;
  categories: { id: string; name: string }[];
}

/**
 * As the owner may see it. "have" is an item they marked as bought
 * themselves. On a list that hides what's been reserved, a gifted item is
 * still "wanted".
 */
export type SavedItemStatus = "wanted" | "gifted" | "have";

export interface SavedItem {
  id: string;
  title: string;
  imageUrl: string | null;
  externalUrl: string | null;
  price: number | null;
  createdAt: string;
  /** The lists it's on, the one it was first saved to first. */
  listIds: string[];
  status: SavedItemStatus;
}

export interface SavedItemsData {
  lists: SavedList[];
  items: SavedItem[];
  /**
   * Whether the person closed the "Start your wishlist" prompt. Optional, since
   * older app builds and stories leave it out.
   */
  wishlistPromptClosed?: boolean;
}

