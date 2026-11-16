import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authenticateExtension, jsonError, readJson } from "@/lib/extension-server";
import { parseGiftIdea } from "@/lib/gift-ideas";
import type { IdeaResponse } from "@/lib/extension";

// POST { idea } → saves a gift idea for someone else, from the popup's form on
// a product page. It runs as the signed-in user, so the table's access rules
// make the idea theirs alone (supabase/migrations/20261115094644_gift_ideas.sql).
export async function POST(request: Request) {
  const auth = await authenticateExtension(request);
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  const body = await readJson(request);
  const parsed = parseGiftIdea(body?.idea);
  if (parsed.error !== undefined) return jsonError(parsed.error, 400);

  const { data, error } = await supabase
    .from("gift_ideas")
    .insert({ ...parsed.fields, owner_id: user.id })
    .select("id, title, recipient")
    .single();
  if (error || !data) {
    console.error("[extension] Failed to save a gift idea:", error);
    return jsonError("The idea wasn't saved. Try again in a moment.", 500);
  }

  revalidatePath("/dashboard/saved/ideas");
  const response: IdeaResponse = {
    added: { id: data.id as string, title: data.title as string, recipient: data.recipient as string },
  };
  return NextResponse.json(response);
}
