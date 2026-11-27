// What a baby registry's checklist page shows
// (src/app/(protected)/dashboard/registry/[registryId]/checklist/page.tsx).
// The website's page and the phone app (src/app/api/app/data) both load it
// here, so they count the same things.
//
// Server-only: it reads with the service-role client after checking that the
// signed-in user manages the list.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/viewer";
import { loadListItems } from "@/lib/list-items";
import { checklistStatus, countedEntry, type ChecklistCandidate } from "@/lib/checklist-matching";
import type { ChecklistPageData, ChecklistPageThing } from "@/lib/checklist-page-types";
import type { PaymentMethods } from "@/lib/types";

interface ItemRow {
  id: string;
  registry_id: string;
  category_id: string | null;
  sort_order: number;
  created_at: string;
  title: string;
  image_url: string | null;
  checklist_entry?: string | null;
}

/** Whether this account manages the list: a row in registry_managers, or its owner. */
async function managesList(registryId: string, userId: string, ownerId: string): Promise<boolean> {
  if (ownerId === userId) return true;
  const { data } = await supabaseAdmin
    .from("registry_managers")
    .select("role")
    .eq("registry_id", registryId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Loads a baby registry's checklist for the signed-in user. Null when they
 * don't manage it, it doesn't exist, or it isn't a baby registry, which the
 * page shows as not found.
 */
export async function loadChecklistPage(registryId: string): Promise<ChecklistPageData | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const { data: registry } = await supabaseAdmin
    .from("registries")
    .select("id, title, owner_id, registry_type, settings")
    .eq("id", registryId)
    .maybeSingle();
  if (!registry || registry.registry_type !== "baby") return null;
  if (!(await managesList(registryId, user.id, registry.owner_id as string))) return null;

  // "*", so the page still loads before the checklist_entries migration runs.
  const [items, { data: funds, error: fundsError }, { data: categories, error: categoriesError }] = await Promise.all([
    loadListItems<ItemRow>(registryId, "*"),
    supabaseAdmin.from("cash_funds").select("*").eq("registry_id", registryId).order("created_at"),
    supabaseAdmin.from("categories").select("id, name").eq("registry_id", registryId).order("sort_order"),
  ]);
  if (fundsError) throw fundsError;
  if (categoriesError) throw categoriesError;

  const candidates: (ChecklistCandidate & { image_url: string | null; placed: boolean })[] = [
    ...items.map((item) => ({
      id: item.id,
      kind: "item" as const,
      title: item.title,
      checklist_entry: item.checklist_entry ?? null,
      image_url: item.image_url,
      placed: item.placed,
    })),
    ...((funds ?? []) as { id: string; title: string; checklist_entry?: string | null }[]).map((fund) => ({
      id: fund.id,
      kind: "fund" as const,
      title: fund.title,
      checklist_entry: fund.checklist_entry ?? null,
      image_url: null,
      placed: false,
    })),
  ];

  const settings = (registry.settings as Record<string, unknown> | null) ?? {};
  const status = checklistStatus(candidates, settings.checklist_dismissed);
  const things: ChecklistPageThing[] = candidates.map((candidate) => {
    const { key, chosen } = countedEntry(candidate);
    return {
      id: candidate.id,
      kind: candidate.kind,
      title: candidate.title,
      image_url: candidate.image_url,
      placed: candidate.placed,
      entry: key,
      chosen,
    };
  });

  return {
    registry: { id: registry.id as string, title: registry.title as string },
    categories: (categories ?? []) as { id: string; name: string }[],
    paymentMethods: (settings.payment_methods as PaymentMethods | undefined) ?? null,
    zipCode: settings.tax_enabled !== false ? (settings.zip_code as string | undefined) : undefined,
    things,
    dismissed: status.dismissed,
    done: status.done,
    total: status.total,
    essentialsDone: status.essentialsDone,
    essentialsTotal: status.essentialsTotal,
  };
}
