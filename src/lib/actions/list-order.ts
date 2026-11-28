"use server";

// Saves the order of a person's lists (src/lib/list-order.ts): on their own
// My registries tab, and on their public profile. The website and the phone
// app (as listOrder.setListOrder and listOrder.setProfileListOrder) both call
// these.

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAccount } from "@/lib/require-account";
import { cleanListOrder } from "@/lib/list-order";
import { createClient } from "@/utils/supabase/server";

/**
 * Saves the order of the lists on the person's My registries tab: the lists
 * they own and the ones they help manage. Only they see it.
 */
export async function setListOrder(ids: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to sign in to do this." };

  const [{ data: owned }, { data: managed }] = await Promise.all([
    supabaseAdmin.from("registries").select("id").eq("owner_id", user.id),
    supabaseAdmin.from("registry_managers").select("registry_id").eq("user_id", user.id),
  ]);
  const allowed = new Set([
    ...(owned ?? []).map((row) => row.id as string),
    ...(managed ?? []).map((row) => row.registry_id as string),
  ]);
  const order = cleanListOrder(ids, allowed);
  if (!order) return { error: "That order didn't save. Try again." };

  // Signed-in sessions can't write this column (20261128085244_list_order.sql).
  const { error } = await supabaseAdmin.from("profiles").update({ list_order: order }).eq("id", user.id);
  if (error) return { error: "That order didn't save. Try again." };

  revalidatePath("/dashboard");
  return { success: true };
}

/** Saves the order of the person's lists on their public profile. */
export async function setProfileListOrder(ids: string[]) {
  const { user, error: authError } = await requireAccount();
  if (!user) return { error: authError };

  const { data: owned } = await supabaseAdmin.from("registries").select("id").eq("owner_id", user.id);
  const order = cleanListOrder(ids, new Set((owned ?? []).map((row) => row.id as string)));
  if (!order) return { error: "That order didn't save. Try again." };

  const { error } = await supabaseAdmin.from("profiles").update({ profile_list_order: order }).eq("id", user.id);
  if (error) return { error: "That order didn't save. Try again." };

  revalidatePath("/dashboard/account");
  revalidatePath("/u/[profile]", "page");
  return { success: true };
}
