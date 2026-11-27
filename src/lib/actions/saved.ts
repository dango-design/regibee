"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { giftsOnItems, sendGiftRemovedEmails } from "@/lib/gift-reservations-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAccount } from "@/lib/require-account";
import { isUuid } from "@/lib/extension";
import { isItemOnList, listsForItems } from "@/lib/list-items";
import { removeItemFromList, revalidateLists } from "@/lib/item-placements";
import { startPlan } from "@/lib/actions/events";
import { listTitleFor, occasionFor } from "@/lib/occasions";

// Putting items on more of your lists, and taking them off, from the Saved
// tab. An item can be on several lists with the same owner, and only that
// owner can place it. Gifts belong to the item, so a gift reserved through any
// of its lists shows on all of them. The placements table is only reachable
// from the server (supabase/migrations/20261112062733_item_placements.sql).

/** The most items one change takes, so a request can't ask for thousands. */
const MAX_ITEMS = 200;

export type SavedActionResult = { error: string } | { success: true; changed: number; deleted: number };

/** The ids of the lists this person owns, among the ones given. */
async function ownedListIds(userId: string, registryIds: string[]): Promise<Set<string>> {
  if (registryIds.length === 0) return new Set();
  const { data } = await supabaseAdmin
    .from("registries")
    .select("id")
    .eq("owner_id", userId)
    .in("id", registryIds);
  return new Set((data ?? []).map((r) => r.id as string));
}

function validRequest(itemIds: unknown, registryId: unknown): itemIds is string[] {
  return (
    isUuid(registryId) &&
    Array.isArray(itemIds) &&
    itemIds.length > 0 &&
    itemIds.length <= MAX_ITEMS &&
    itemIds.every(isUuid)
  );
}

/**
 * Puts items on one of your lists. Items already on it are left alone, and
 * so are items you don't own.
 */
export async function addItemsToList(itemIds: string[], registryId: string): Promise<SavedActionResult> {
  const { user, error } = await requireAccount();
  if (error || !user) return { error: error || "You need an account to do this." };
  if (!validRequest(itemIds, registryId)) return { error: "Choose a list and some items." };

  const lists = await listsForItems(itemIds);
  const homeIds = [...new Set([...lists.values()].map((ids) => ids[0]))];
  const owned = await ownedListIds(user.id, [registryId, ...homeIds]);
  if (!owned.has(registryId)) return { error: "You can only add items to your own lists." };

  const placeable = [...lists.entries()]
    .filter(([, ids]) => owned.has(ids[0]) && !ids.includes(registryId))
    .map(([itemId]) => itemId);

  if (placeable.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("registry_item_placements").upsert(
      placeable.map((itemId) => ({ item_id: itemId, registry_id: registryId, added_by: user.id })),
      { onConflict: "item_id,registry_id", ignoreDuplicates: true },
    );
    if (insertError) {
      console.error("[saved] Failed to add items to a list:", insertError);
      return { error: "Those items weren't added. Try again in a moment." };
    }
  }

  revalidateLists([registryId]);
  return { success: true, changed: placeable.length, deleted: 0 };
}

/**
 * Moves an item from one of your lists to another. It's put on the new list
 * first and then taken off the old one, so it's never deleted and its gifts
 * stay with it. It arrives with no category, since categories belong to a list.
 */
export async function moveItemToList(itemId: string, fromRegistryId: string, toRegistryId: string): Promise<SavedActionResult> {
  const { user, error } = await requireAccount();
  if (error || !user) return { error: error || "You need an account to do this." };
  if (!isUuid(itemId) || !isUuid(fromRegistryId) || !isUuid(toRegistryId) || fromRegistryId === toRegistryId) {
    return { error: "Choose another list to move it to." };
  }

  const lists = (await listsForItems([itemId])).get(itemId) ?? [];
  if (!lists.includes(fromRegistryId)) return { error: "That item isn't on this list anymore." };
  const owned = await ownedListIds(user.id, [fromRegistryId, toRegistryId, lists[0]]);
  if (!owned.has(fromRegistryId) || !owned.has(toRegistryId) || !owned.has(lists[0])) {
    return { error: "You can only move items between your own lists." };
  }

  if (!lists.includes(toRegistryId)) {
    const { error: insertError } = await supabaseAdmin
      .from("registry_item_placements")
      .upsert(
        { item_id: itemId, registry_id: toRegistryId, added_by: user.id },
        { onConflict: "item_id,registry_id", ignoreDuplicates: true },
      );
    if (insertError) {
      console.error("[saved] Failed to move an item to a list:", insertError);
      return { error: "That item wasn't moved. Try again in a moment." };
    }
  }

  // Only once it's on the new list: taking it off its only list deletes it.
  if (!(await isItemOnList(itemId, toRegistryId))) {
    return { error: "That item wasn't moved. Try again in a moment." };
  }
  const result = await removeItemFromList(itemId, fromRegistryId);
  revalidateLists([...lists, toRegistryId]);
  if ("error" in result) {
    console.error("[saved] Failed to take a moved item off its old list:", result.error);
    return { error: "It was added to the other list, but it's still on this one. Try removing it here." };
  }
  return { success: true, changed: 1, deleted: 0 };
}

/**
 * Takes items off one of your lists. An item that's on another of your lists
 * stays there. An item on no other list is deleted.
 */
export async function removeItemsFromList(itemIds: string[], registryId: string): Promise<SavedActionResult> {
  const { user, error } = await requireAccount();
  if (error || !user) return { error: error || "You need an account to do this." };
  if (!validRequest(itemIds, registryId)) return { error: "Choose a list and some items." };

  const owned = await ownedListIds(user.id, [registryId]);
  if (!owned.has(registryId)) return { error: "You can only change your own lists." };

  const lists = await listsForItems(itemIds);
  const onList = [...lists.entries()].filter(([, ids]) => ids.includes(registryId));

  let changed = 0;
  let deleted = 0;
  const touched = new Set<string>([registryId]);
  for (const [itemId, ids] of onList) {
    // An item on no other list is deleted, and its gifts with it. Read them
    // first, so their guests can be told, as deleteRegistryItem does.
    const gifts = ids.length === 1 ? await giftsOnItems([itemId]) : [];
    const result = await removeItemFromList(itemId, registryId);
    if (!("error" in result) && result.removed === "deleted" && gifts.length > 0) {
      after(() => sendGiftRemovedEmails(gifts));
    }
    if ("error" in result) {
      console.error("[saved] Failed to take an item off a list:", result.error);
      revalidateLists(touched);
      return { error: changed > 0 ? `${changed} were taken off, then something went wrong. Try again.` : "That didn't work. Try again in a moment." };
    }
    changed += 1;
    if (result.removed === "deleted") deleted += 1;
    for (const id of ids) touched.add(id);
  }

  revalidateLists(touched);
  return { success: true, changed, deleted };
}

/**
 * Makes your wishlist in one click: a personal list for you, named after you,
 * with no event. Returns its id.
 */
export async function startMyWishlist(): Promise<{ error: string } | { registryId: string }> {
  const { user, error } = await requireAccount();
  if (error || !user) return { error: error || "You need an account to do this." };

  const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  // The picker suggests your first name.
  const name = ((profile?.full_name as string | null) ?? "").trim().split(/\s+/)[0] ?? "";
  const occasion = occasionFor("other");

  const result = await startPlan({
    occasion: "other",
    audience: "me",
    name,
    gifts: "new_list",
    invitation: false,
    linkUrl: "",
    askEmail: "",
    title: listTitleFor(occasion, name),
    date: "",
  });
  if (result.error !== null) return { error: result.error };

  const registryId = result.href.match(/\/dashboard\/registry\/([0-9a-f-]{36})/)?.[1];
  if (!registryId) return { error: "Your wishlist was made. Find it on My registries." };
  revalidateLists([registryId]);
  return { registryId };
}

/**
 * Closes the "Start your wishlist" prompt on the Saved tab, for this account on
 * every device. For someone who keeps a birthday wishlist or a Christmas list
 * instead of one main wishlist.
 */
export async function dismissWishlistPrompt(): Promise<{ error: string | null }> {
  const { user, error } = await requireAccount();
  if (error || !user) return { error: error || "You need an account to do this." };

  const { error: saveError } = await supabaseAdmin
    .from("profiles")
    .update({ wishlist_prompt_dismissed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (saveError) {
    console.error("[saved] Failed to close the wishlist prompt:", saveError);
    return { error: "That didn't save. Try again in a moment." };
  }
  revalidatePath("/dashboard/saved");
  return { error: null };
}
