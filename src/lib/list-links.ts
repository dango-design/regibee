import { supabaseAdmin } from "@/lib/supabase-admin";

// A list's managers can replace its link on the Settings page
// (replaceRegistryLink in src/lib/actions/registry.ts). The old link stops
// opening the list. The database keeps it in registry_old_links
// (supabase/migrations/20261114100553_list_links.sql) for one reason: a
// guest's gift emails hold the old link, and they should still lead to the
// guest's gift. Only a link that proves the visitor gave a gift on the list
// gets them there: the gift link with its purchase id, or the signed "see
// your gifts" link. Anyone else with an old link sees the not-found page.

/**
 * The list an old link belonged to, with its current slug. Null when the link
 * was never a list's, and before the migration has run.
 */
export async function listForOldLink(slug: string): Promise<{ id: string; slug: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("registry_old_links")
    .select("registries(id, slug)")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const list = (data as unknown as { registries: { id: string; slug: string } | null }).registries;
  return list ?? null;
}

/** Whether old links can be kept yet: false until the migration has run. */
export async function canKeepOldLinks(): Promise<boolean> {
  const { error } = await supabaseAdmin.from("registry_old_links").select("slug", { head: true }).limit(1);
  return !error;
}
