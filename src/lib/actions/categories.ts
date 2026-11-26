"use server";

// "Sort into categories" on a list's page: puts each item with no category in
// the one that fits it best, adding the categories the list doesn't have yet,
// and can put everything back. The guessing is in src/lib/item-categories.ts.

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isUuid } from "@/lib/extension";
import { canManageRegistry } from "@/lib/events-server";
import { loadListItems } from "@/lib/list-items";
import { addListCategory } from "@/lib/list-categories";
import { PLANNED_CATEGORY_PREFIX, sortPlan } from "@/lib/item-categories";

/** What the sort changed, so Undo can put it back. */
export interface CategorySortUndo {
  /** Each item moved, the category it went in, and whether it's on this list through a placement. */
  moved: { itemId: string; categoryId: string; placed: boolean }[];
  /** The categories the sort added. */
  added: string[];
}

export interface CategorySortResult {
  error?: string;
  /** How many items went into a category. */
  sorted?: number;
  /** How many categories were added. */
  added?: number;
  undo?: CategorySortUndo;
}

/** The signed-in account's session, when it manages the list. */
async function managerSession(registryId: string) {
  if (!isUuid(registryId)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !(await canManageRegistry(user.id, registryId))) return null;
  return supabase;
}

interface SortItem {
  id: string;
  registry_id: string;
  category_id: string | null;
  sort_order: number;
  created_at: string;
  title: string;
}

/**
 * Puts the list's items that have no category into the category that fits
 * each best. An item's category on a list it was placed on belongs to that
 * placement (src/lib/list-items.ts), so it changes only there.
 */
export async function sortIntoCategories(registryId: string): Promise<CategorySortResult> {
  const supabase = await managerSession(registryId);
  if (!supabase) return { error: "List not found" };

  const [items, { data: categoryRows, error: readError }] = await Promise.all([
    loadListItems<SortItem>(registryId, "id, registry_id, category_id, sort_order, created_at, title"),
    supabase.from("categories").select("id, name").eq("registry_id", registryId),
  ]);
  if (readError) return { error: readError.message };
  const categories = (categoryRows ?? []) as { id: string; name: string }[];
  const categoryIds = new Set(categories.map((c) => c.id));
  const loose = items.filter((item) => !item.category_id);
  const placedIds = new Set(items.filter((item) => item.placed).map((item) => item.id));

  const plan = sortPlan(loose, categories);
  if (plan.assignments.length === 0) return { sorted: 0, added: 0, undo: { moved: [], added: [] } };

  // Add the categories the list doesn't have yet.
  const realId = new Map<string, string>();
  const added: string[] = [];
  for (const name of plan.newNames) {
    const result = await addListCategory(supabase, registryId, name);
    if ("error" in result) continue;
    realId.set(`${PLANNED_CATEGORY_PREFIX}${name}`, result.category.id);
    if (!categoryIds.has(result.category.id)) added.push(result.category.id);
  }

  // Move the items, a category at a time. Only items that still have no
  // category move, in case someone chose one meanwhile.
  const byCategory = new Map<string, { home: string[]; placed: string[] }>();
  for (const { itemId, categoryId } of plan.assignments) {
    const id = realId.get(categoryId) ?? (categoryId.startsWith(PLANNED_CATEGORY_PREFIX) ? null : categoryId);
    if (!id) continue;
    const group = byCategory.get(id) ?? { home: [], placed: [] };
    (placedIds.has(itemId) ? group.placed : group.home).push(itemId);
    byCategory.set(id, group);
  }
  const moved: CategorySortUndo["moved"] = [];
  for (const [categoryId, group] of byCategory) {
    if (group.home.length > 0) {
      // Their own session, so the access rules decide what they can change.
      const { data } = await supabase
        .from("registry_items")
        .update({ category_id: categoryId })
        .eq("registry_id", registryId)
        .in("id", group.home)
        .is("category_id", null)
        .select("id");
      for (const row of data ?? []) moved.push({ itemId: row.id as string, categoryId, placed: false });
    }
    if (group.placed.length > 0) {
      // Placements are only changed on the server, after the manager check above.
      const { data } = await supabaseAdmin
        .from("registry_item_placements")
        .update({ category_id: categoryId })
        .eq("registry_id", registryId)
        .in("item_id", group.placed)
        .is("category_id", null)
        .select("item_id");
      for (const row of data ?? []) moved.push({ itemId: row.item_id as string, categoryId, placed: true });
    }
  }

  // A category added for items that then didn't move would sit there empty.
  const used = new Set(moved.map((m) => m.categoryId));
  const unused = added.filter((id) => !used.has(id));
  if (unused.length > 0) await supabase.from("categories").delete().eq("registry_id", registryId).in("id", unused);
  const kept = added.filter((id) => used.has(id));

  revalidatePath(`/dashboard/registry/${registryId}`);
  return { sorted: moved.length, added: kept.length, undo: { moved, added: kept } };
}

/**
 * Puts back what sortIntoCategories changed: items that are still in the
 * category it gave them go back to having none, and the categories it added
 * are removed once nothing is in them.
 */
export async function undoCategorySort(registryId: string, undo: CategorySortUndo): Promise<{ error?: string }> {
  const supabase = await managerSession(registryId);
  if (!supabase) return { error: "List not found" };
  const moved = Array.isArray(undo?.moved)
    ? undo.moved.filter((m) => isUuid(m?.itemId) && isUuid(m?.categoryId)).slice(0, 2000)
    : [];
  const added = Array.isArray(undo?.added) ? undo.added.filter((id) => isUuid(id)).slice(0, 100) : [];

  const byCategory = new Map<string, { home: string[]; placed: string[] }>();
  for (const m of moved) {
    const group = byCategory.get(m.categoryId) ?? { home: [], placed: [] };
    (m.placed ? group.placed : group.home).push(m.itemId);
    byCategory.set(m.categoryId, group);
  }
  for (const [categoryId, group] of byCategory) {
    if (group.home.length > 0) {
      const { error } = await supabase
        .from("registry_items")
        .update({ category_id: null })
        .eq("registry_id", registryId)
        .eq("category_id", categoryId)
        .in("id", group.home);
      if (error) return { error: error.message };
    }
    if (group.placed.length > 0) {
      const { error } = await supabaseAdmin
        .from("registry_item_placements")
        .update({ category_id: null })
        .eq("registry_id", registryId)
        .eq("category_id", categoryId)
        .in("item_id", group.placed);
      if (error) return { error: error.message };
    }
  }

  // Remove the added categories that are empty again. One the owner has put
  // something else in since stays.
  for (const categoryId of added) {
    const [{ count: items }, { count: placements }] = await Promise.all([
      supabaseAdmin.from("registry_items").select("id", { count: "exact", head: true }).eq("category_id", categoryId),
      supabaseAdmin.from("registry_item_placements").select("item_id", { count: "exact", head: true }).eq("category_id", categoryId),
    ]);
    if ((items ?? 0) === 0 && (placements ?? 0) === 0) {
      await supabase.from("categories").delete().eq("registry_id", registryId).eq("id", categoryId);
    }
  }

  revalidatePath(`/dashboard/registry/${registryId}`);
  return {};
}
