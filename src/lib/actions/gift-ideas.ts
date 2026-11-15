"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/require-account";
import { isUuid } from "@/lib/extension";
import { parseGiftIdea, type GiftIdeaInput } from "@/lib/gift-ideas";

// Saving, changing and deleting gift ideas from the website. These run as the
// signed-in account, so the table's access rules keep each account to its
// own ideas (supabase/migrations/20261115094644_gift_ideas.sql).

export type GiftIdeaResult = { error: string } | { success: true; id: string };

const IDEAS_PATH = "/dashboard/saved/ideas";

/** Saves a new idea, or changes the one with this id. */
export async function saveGiftIdea(input: GiftIdeaInput, id?: string): Promise<GiftIdeaResult> {
  const { user, supabase, error } = await requireAccount();
  if (error || !user) return { error: error || "You need an account to do this." };

  const parsed = parseGiftIdea(input);
  if (parsed.error !== undefined) return { error: parsed.error };

  if (id !== undefined) {
    if (!isUuid(id)) return { error: "That gift idea doesn't exist." };
    const { data, error: updateError } = await supabase
      .from("gift_ideas")
      .update(parsed.fields)
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (updateError) {
      console.error("[gift-ideas] Failed to change an idea:", updateError);
      return { error: "Your changes weren't saved. Try again in a moment." };
    }
    if (!data) return { error: "That gift idea was deleted." };
    revalidatePath(IDEAS_PATH);
    return { success: true, id: data.id as string };
  }

  const { data, error: insertError } = await supabase
    .from("gift_ideas")
    .insert({ ...parsed.fields, owner_id: user.id })
    .select("id")
    .single();
  if (insertError || !data) {
    console.error("[gift-ideas] Failed to save an idea:", insertError);
    return { error: "The idea wasn't saved. Try again in a moment." };
  }
  revalidatePath(IDEAS_PATH);
  return { success: true, id: data.id as string };
}

/** Marks an idea as bought, or back to still an idea. */
export async function setGiftIdeaBought(id: string, bought: boolean): Promise<GiftIdeaResult> {
  const { user, supabase, error } = await requireAccount();
  if (error || !user) return { error: error || "You need an account to do this." };
  if (!isUuid(id)) return { error: "That gift idea doesn't exist." };

  const { data, error: updateError } = await supabase
    .from("gift_ideas")
    .update({ bought_at: bought ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (updateError) {
    console.error("[gift-ideas] Failed to mark an idea:", updateError);
    return { error: "That didn't save. Try again in a moment." };
  }
  if (!data) return { error: "That gift idea was deleted." };
  revalidatePath(IDEAS_PATH);
  return { success: true, id };
}

export async function deleteGiftIdea(id: string): Promise<GiftIdeaResult> {
  const { user, supabase, error } = await requireAccount();
  if (error || !user) return { error: error || "You need an account to do this." };
  if (!isUuid(id)) return { error: "That gift idea doesn't exist." };

  const { error: deleteError } = await supabase.from("gift_ideas").delete().eq("id", id).eq("owner_id", user.id);
  if (deleteError) {
    console.error("[gift-ideas] Failed to delete an idea:", deleteError);
    return { error: "The idea wasn't deleted. Try again in a moment." };
  }
  revalidatePath(IDEAS_PATH);
  return { success: true, id };
}
