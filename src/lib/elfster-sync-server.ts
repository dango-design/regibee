// Keeping a list in sync with an Elfster wishlist (src/lib/wishlist-import.ts
// has the rules). The extension's routes call these after checking that the
// person manages the list. The tables (20261128070237_elfster_sync.sql) have
// no access rules for any API role, so only this file reads or writes them,
// with the service-role client.
//
// What's been given on Elfster is for guests only. Nothing here returns it.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { importItemKey } from "@/lib/extension";
import { LINK_COLUMNS, loadListItems, type LinkRow } from "@/lib/list-items";
import { planWishlistSync, type ImportItem, type SyncListItem } from "@/lib/wishlist-import";

// The rule for how a guest sees an item has no imports, so its tests can run it.
export { withElfsterGifts } from "@/lib/wishlist-import";

/** True when the list is kept in sync with that wishlist. */
export async function isSyncedWith(registryId: string, wishlistId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("elfster_wishlists")
    .select("registry_id")
    .eq("registry_id", registryId)
    .eq("wishlist_id", wishlistId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't read the Elfster sync: ${error.message}`);
  return data !== null;
}

/**
 * Starts keeping the list in sync with the wishlist, if it wasn't already,
 * and saves which item each wish is and how many have been given on Elfster.
 * Returns the items whose wish is no longer on the wishlist, so the
 * manager can decide what to do with them.
 */
export async function syncWishlist(
  registryId: string,
  wishlistId: string,
  userId: string,
  wishes: ImportItem[],
): Promise<{ gone: { id: string; title: string }[] }> {
  const now = new Date().toISOString();
  const { error: linkError } = await supabaseAdmin
    .from("elfster_wishlists")
    .upsert({ registry_id: registryId, wishlist_id: wishlistId, linked_by: userId, synced_at: now }, {
      onConflict: "registry_id,wishlist_id",
      ignoreDuplicates: false,
    });
  if (linkError) throw new Error(`Couldn't save the Elfster sync: ${linkError.message}`);

  // Items placed on this list from the owner's other lists count too.
  const rows = await loadListItems<LinkRow>(registryId, LINK_COLUMNS);
  const listItems: SyncListItem[] = rows.map((row) => ({ id: row.id, title: row.title, url: row.external_url }));

  const { data: synced, error: readError } =
    listItems.length === 0
      ? { data: [], error: null }
      : await supabaseAdmin
          .from("elfster_wishes")
          .select("item_id, wish_id")
          .eq("wishlist_id", wishlistId)
          .in(
            "item_id",
            listItems.map((item) => item.id),
          );
  if (readError) throw new Error(`Couldn't read the Elfster wishes: ${readError.message}`);

  const plan = planWishlistSync(
    wishes,
    listItems,
    (synced ?? []).map((row) => ({ itemId: row.item_id as string, wishId: row.wish_id as string })),
    importItemKey,
  );

  if (plan.matched.length > 0) {
    const { error } = await supabaseAdmin.from("elfster_wishes").upsert(
      plan.matched.map((m) => ({
        item_id: m.itemId,
        wishlist_id: wishlistId,
        wish_id: m.wishId,
        given: m.given,
        synced_at: now,
      })),
      { onConflict: "item_id" },
    );
    if (error) throw new Error(`Couldn't save the Elfster wishes: ${error.message}`);
  }

  return { gone: plan.gone.map((item) => ({ id: item.id, title: item.title })) };
}

/**
 * Stops keeping the list in sync with the wishlist. Its items stop counting
 * what's been given on Elfster, so guests can choose them again.
 */
export async function stopWishlistSync(registryId: string, wishlistId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("elfster_wishlists")
    .delete()
    .eq("registry_id", registryId)
    .eq("wishlist_id", wishlistId);
  if (error) throw new Error(`Couldn't stop the Elfster sync: ${error.message}`);

  const rows = await loadListItems<LinkRow>(registryId, LINK_COLUMNS);
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return;
  const { error: wishError } = await supabaseAdmin
    .from("elfster_wishes")
    .delete()
    .eq("wishlist_id", wishlistId)
    .in("item_id", ids);
  if (wishError) throw new Error(`Couldn't stop the Elfster sync: ${wishError.message}`);
}

/**
 * How many of each item have been given on Elfster, for the guest page. An
 * item with none is left out. Fails soft: the page still loads without them.
 */
export async function givenOnElfster(itemIds: string[]): Promise<Map<string, number>> {
  const given = new Map<string, number>();
  if (itemIds.length === 0) return given;
  const { data, error } = await supabaseAdmin
    .from("elfster_wishes")
    .select("item_id, given")
    .in("item_id", itemIds)
    .gt("given", 0);
  if (error) {
    console.error("[elfster] Couldn't read what's been given on Elfster:", error.message);
    return given;
  }
  for (const row of data ?? []) given.set(row.item_id as string, row.given as number);
  return given;
}
