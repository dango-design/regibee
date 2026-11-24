// What deleting one registry would do, for the confirmation on its Settings
// page. Server only: it uses the service-role client, so the caller must have
// checked that the person asking owns the registry.

import type { RegistryDeletionSummary } from "@/lib/delete-confirmation";
import { listsForItems, loadPlacements } from "@/lib/list-items";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Filters with long id lists go in the URL, so they're sent in batches.
const BATCH = 100;

function batches<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += BATCH) out.push(list.slice(i, i + BATCH));
  return out;
}

/** Counts what's on the registry and what its deletion deletes, without changing anything. */
export async function summarizeRegistryDeletion(registryId: string): Promise<RegistryDeletionSummary> {
  const [items, funds, placements] = await Promise.all([
    supabaseAdmin.from("registry_items").select("id").eq("registry_id", registryId),
    supabaseAdmin.from("cash_funds").select("id").eq("registry_id", registryId),
    loadPlacements([registryId]),
  ]);
  if (items.error) throw items.error;
  if (funds.error) throw funds.error;

  const homeIds = (items.data ?? []).map((i) => i.id as string);
  const fundIds = (funds.data ?? []).map((f) => f.id as string);

  // An item saved here that's also on another list moves there when this
  // registry is deleted (rehome_placed_items), and keeps its gifts.
  const lists = await listsForItems(homeIds);
  const deletedIds = homeIds.filter((id) => (lists.get(id) ?? []).length <= 1);
  const placedIds = new Set(placements.map((p) => p.item_id).filter((id) => !homeIds.includes(id)));

  const lookups = [
    ...batches(deletedIds).map((ids) =>
      supabaseAdmin.from("purchases").select("id").neq("status", "cancelled").in("registry_item_id", ids),
    ),
    ...batches(fundIds).map((ids) =>
      supabaseAdmin.from("purchases").select("id").neq("status", "cancelled").in("cash_fund_id", ids),
    ),
  ];
  const gifts = new Set<string>();
  for (const { data, error } of await Promise.all(lookups)) {
    if (error) throw error;
    for (const p of data ?? []) gifts.add(p.id as string);
  }

  return {
    deletedItems: deletedIds.length,
    movedItems: homeIds.length - deletedIds.length,
    placedItems: placedIds.size,
    funds: fundIds.length,
    gifts: gifts.size,
  };
}
