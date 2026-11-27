"use server";

// Filling in items' details later, from their store links (src/lib/item-details.ts).
// The extension reads each link in the owner's browser. These save what it
// found, and let the list's managers review the changes and put old values back.

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isUuid, parseReadProduct } from "@/lib/extension";
import { listsForItems } from "@/lib/list-items";
import { revalidateLists } from "@/lib/item-placements";
import {
  detailChanges,
  parseDetailChanges,
  priceChanges,
  shownSide,
  turnedDownBefore,
  type DetailChange,
  type DetailField,
  type ShownSide,
} from "@/lib/item-details";

const ITEM_COLUMNS = "id, title, price, image_url, external_url, is_parent_purchased";

interface SavedItem {
  id: string;
  title: string;
  price: number | null;
  image_url: string | null;
  external_url: string | null;
  is_parent_purchased: boolean;
}

/** Whether this account owns or helps manage the list. */
async function managesList(userId: string, registryId: string): Promise<boolean> {
  const [{ data: manager }, { data: registry }] = await Promise.all([
    supabaseAdmin.from("registry_managers").select("role").eq("registry_id", registryId).eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("registries").select("owner_id").eq("id", registryId).maybeSingle(),
  ]);
  return Boolean(manager) || registry?.owner_id === userId;
}

/**
 * The signed-in manager, and the lists the item is on, when the item is on
 * this list and they manage it. The item itself is read and changed with
 * their own session, so the access rules still decide what they can change.
 */
async function itemAccess(registryId: string, itemId: string) {
  if (!isUuid(registryId) || !isUuid(itemId)) return { error: "Item not found" } as const;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { error: "Please sign in." } as const;
  const lists = (await listsForItems([itemId])).get(itemId) ?? [];
  if (!lists.includes(registryId) || !(await managesList(user.id, registryId))) {
    return { error: "Item not found" } as const;
  }
  const { data: item } = await supabase.from("registry_items").select(ITEM_COLUMNS).eq("id", itemId).maybeSingle();
  if (!item) return { error: "Item not found" } as const;
  return { supabase, lists, item: item as SavedItem } as const;
}

/**
 * Saves what the extension read from an item's link: fills in what's missing
 * and replaces what the store has differently, keeping the old values for the
 * review. `readUrl` is the item's link as the page had it, so a link changed
 * in the meantime isn't filled in from the old one.
 */
export async function saveReadDetails(
  registryId: string,
  itemId: string,
  readUrl: string,
  read: unknown,
): Promise<{ error?: string; changes?: DetailChange[] }> {
  return saveRead(registryId, itemId, readUrl, read, "details");
}

/**
 * Saves the price the extension read when the list's page checked it
 * (PriceCheck). Changes only the price, on the same rules as saveReadDetails,
 * and leaves an item alone while its last read waits for review.
 */
export async function savePriceCheck(
  registryId: string,
  itemId: string,
  readUrl: string,
  read: unknown,
): Promise<{ error?: string; changes?: DetailChange[] }> {
  return saveRead(registryId, itemId, readUrl, read, "price");
}

async function saveRead(
  registryId: string,
  itemId: string,
  readUrl: string,
  read: unknown,
  kind: "details" | "price",
): Promise<{ error?: string; changes?: DetailChange[] }> {
  const product = parseReadProduct(read);
  if (!product) return { error: "Nothing was read from the store." };
  const access = await itemAccess(registryId, itemId);
  if ("error" in access) return { error: access.error };
  const { supabase, lists, item } = access;
  if (!item.external_url || item.external_url !== readUrl) {
    return { error: "The item's link changed while it was being read." };
  }

  const changes = kind === "price" ? priceChanges(item, product) : detailChanges(item, product);

  if (kind === "price") {
    const { data: last } = await supabaseAdmin
      .from("item_detail_reads")
      .select("read_url, changes, reviewed_at")
      .eq("item_id", itemId)
      .maybeSingle();
    // Another read's changes are waiting for review. Saving this one would
    // replace them, and the old values with them.
    if (last && !last.reviewed_at && parseDetailChanges(last.changes).length > 0) return { changes: [] };
    // The store has the price the owner already switched back from. Keep that
    // read, so the next check knows it too, and count this one as a check.
    if (last && turnedDownBefore({ ...item, external_url: readUrl }, last, changes)) {
      const { error } = await supabaseAdmin
        .from("item_detail_reads")
        .update({ read_at: new Date().toISOString() })
        .eq("item_id", itemId);
      if (error) return { error: error.message };
      return { changes: [] };
    }
  }
  const update: Record<string, string | number> = {};
  for (const change of changes) update[change.field] = change.after;
  // A barcode belongs to the link it was read from (src/lib/gtin.ts), which is
  // the item's link. It isn't shown, so it isn't part of the review.
  if (product.gtin) update.gtin = product.gtin;

  if (Object.keys(update).length > 0) {
    const { data: updated, error } = await supabase.from("registry_items").update(update).eq("id", itemId).select("id");
    if (error) return { error: error.message };
    // The access rules match nothing, without an error, for someone who helps
    // with this list but not with the list the item was first saved to.
    if (!updated || updated.length === 0) return { error: "Only the list's owner can change this item." };
  }

  // A read that changed nothing needs no review, and isn't offered again.
  // Its time still counts as the item's last price check.
  const now = new Date().toISOString();
  const { error: readError } = await supabaseAdmin.from("item_detail_reads").upsert({
    item_id: itemId,
    read_url: readUrl,
    read_at: now,
    changes,
    reviewed_at: changes.length > 0 ? null : now,
  });
  if (readError) return { error: readError.message };

  // Nothing on the page changes after a check that found the same price.
  if (Object.keys(update).length > 0 || kind === "details") revalidateLists(lists);
  return { changes };
}

/** Shows the old value of one change again, or the read's value. */
export async function chooseDetailValue(
  registryId: string,
  itemId: string,
  field: DetailField,
  side: ShownSide,
): Promise<{ error?: string }> {
  if (field !== "title" && field !== "price" && field !== "image_url") return { error: "Unknown field" };
  if (side !== "before" && side !== "after") return { error: "Unknown value" };
  const access = await itemAccess(registryId, itemId);
  if ("error" in access) return { error: access.error };
  const { supabase, lists, item } = access;

  const { data: read } = await supabaseAdmin
    .from("item_detail_reads")
    .select("changes, reviewed_at")
    .eq("item_id", itemId)
    .maybeSingle();
  const change = read && !read.reviewed_at ? parseDetailChanges(read.changes).find((c) => c.field === field) : undefined;
  if (!change) return { error: "There's nothing to change back here anymore." };
  const shown = shownSide(change, item);
  if (shown === side) return {};
  if (!shown) return { error: "This item was edited since. Edit it again to change it." };

  const value = change[side];
  // A name can't be empty. A read never fills an empty one, so this is only a guard.
  if (field === "title" && (value === null || value === "")) return { error: "An item needs a name." };
  const { data: updated, error } = await supabase
    .from("registry_items")
    .update({ [field]: value })
    .eq("id", itemId)
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "Only the list's owner can change this item." };

  revalidateLists(lists);
  return {};
}

/**
 * "Don't check this price again" on the review. Turns the item's price checks
 * off for the link it has now, or back on. A new link turns them on again.
 */
export async function setPriceChecks(registryId: string, itemId: string, on: boolean): Promise<{ error?: string }> {
  if (typeof on !== "boolean") return { error: "Unknown value" };
  const access = await itemAccess(registryId, itemId);
  if ("error" in access) return { error: access.error };
  const { item } = access;
  if (!item.external_url) return { error: "This item has no link to check." };

  const { data: updated, error } = await supabaseAdmin
    .from("item_detail_reads")
    .update({ price_checks_off_url: on ? null : item.external_url })
    .eq("item_id", itemId)
    .select("item_id");
  if (error) return { error: error.message };
  // Only an item that has been read shows the checkbox.
  if (!updated || updated.length === 0) return { error: "There's nothing to change here anymore." };
  return {};
}

/** Marks these items' filled-in details as reviewed, so the review goes away. */
export async function finishDetailReview(registryId: string, itemIds: string[]): Promise<{ error?: string }> {
  if (!isUuid(registryId) || !Array.isArray(itemIds) || itemIds.length > 1000 || !itemIds.every(isUuid)) {
    return { error: "Item not found" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { error: "Please sign in." };
  if (!(await managesList(user.id, registryId))) return { error: "Item not found" };

  const lists = await listsForItems(itemIds);
  const onThisList = itemIds.filter((id) => lists.get(id)?.includes(registryId));
  if (onThisList.length > 0) {
    const { error } = await supabaseAdmin
      .from("item_detail_reads")
      .update({ reviewed_at: new Date().toISOString() })
      .in("item_id", onThisList)
      .is("reviewed_at", null);
    if (error) return { error: error.message };
  }
  revalidatePath(`/dashboard/registry/${registryId}`);
  return {};
}
