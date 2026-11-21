// Making a category on a list. The website's "+ New category" (the add and
// edit item dialogs and Settings) and the phone app's go through
// createCategory in src/lib/actions/registry.ts; the browser extension's goes
// through POST /api/extension/categories. Both call addListCategory, so a new
// category follows the same rules everywhere. The name rules are in
// item-categories.ts, which the phone app and the extension share.

import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryName, categoryNamed } from "./item-categories.ts";

export interface ListCategory {
  id: string;
  name: string;
  sort_order: number;
}

/**
 * Adds a category at the end of a list's categories. A category with that
 * name already on the list, whatever its capitals, comes back instead of a
 * second one. The client runs as the signed-in user, so the access rules
 * decide whether they may change the list.
 */
export async function addListCategory(
  client: SupabaseClient,
  registryId: string,
  rawName: unknown,
): Promise<{ category: ListCategory } | { error: string }> {
  const name = categoryName(rawName);
  if (!name) return { error: "Give the category a name." };

  const { data: existing, error: readError } = await client
    .from("categories")
    .select("id, name, sort_order")
    .eq("registry_id", registryId);
  if (readError) return { error: readError.message };

  const categories = (existing ?? []) as ListCategory[];
  const same = categoryNamed(categories, name);
  if (same) return { category: same };

  const nextOrder = categories.reduce((max, c) => Math.max(max, c.sort_order + 1), 0);
  const { data, error } = await client
    .from("categories")
    .insert({ registry_id: registryId, name, sort_order: nextOrder })
    .select("id, name, sort_order")
    .single();
  if (error || !data) return { error: error?.message ?? "The category wasn't added. Try again." };
  return { category: data as ListCategory };
}
