// The preview of a list on an event's invitation: how many items still need a
// giver, and a few of them to picture. getEventRegistries
// (src/lib/events-server.ts) loads the items and calls this.
//
// This file only imports another file with no imports, so the unit tests can run it.

import { withElfsterGifts } from "./wishlist-import.ts";

export interface PreviewItem {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
  quantity_needed: number;
  quantity_fulfilled: number;
  is_essential: boolean;
  is_parent_purchased: boolean | null;
}

/**
 * How many of a list's items still need a giver, and up to `limit` of them
 * for the preview. `elfsterGiven` is how many of each item have been given on
 * Elfster. Pass it only to someone who doesn't manage the list: Elfster never
 * shows owners what's been bought for them, so neither do we.
 */
export function listPreview(
  items: PreviewItem[],
  limit: number,
  elfsterGiven: Map<string, number> = new Map(),
): { itemsLeft: number; items: { id: string; title: string; image_url: string | null; price: number | null }[] } {
  const open = items
    .map((item) => withElfsterGifts(item, elfsterGiven))
    .filter((item) => item.quantity_fulfilled < item.quantity_needed)
    // Most wanted first, then in list order.
    .sort((a, b) => Number(b.is_essential) - Number(a.is_essential));
  return {
    itemsLeft: open.length,
    // Items with a picture first: the preview is a row of pictures.
    items: [...open]
      .sort((a, b) => Number(Boolean(b.image_url)) - Number(Boolean(a.image_url)))
      .slice(0, limit)
      .map((item) => ({ id: item.id, title: item.title, image_url: item.image_url, price: item.price })),
  };
}
