import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GiftIdeas } from "@/components/gift-ideas";
import { GIFT_IDEA_COLUMNS, toGiftIdea, type GiftIdeaRow } from "@/lib/gift-ideas";
import { findSharedLink } from "@/lib/shared-link";
import { getSessionUser } from "@/lib/viewer";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Gift ideas",
};

type SearchParams = { add?: string; url?: string; title?: string };

// Gifts you might give other people, grouped by who they're for. Only you can
// see them: the query runs as you, and the table's access rules return only
// your own ideas.
export default async function GiftIdeasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams]);

  if (!user) {
    redirect("/login");
  }

  // Guests have anonymous sessions from reserving a gift, which get past the
  // /dashboard check, but they have no account to save ideas to.
  if (user.is_anonymous) {
    redirect("/signup?redirect=/dashboard/saved/ideas");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gift_ideas")
    .select(GIFT_IDEA_COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;

  // A product shared from a phone (/share): open the save dialog on it.
  const shared = params.add ? findSharedLink({ url: params.url, title: params.title }) : null;

  return <GiftIdeas ideas={((data ?? []) as GiftIdeaRow[]).map(toGiftIdea)} openWithLink={shared ?? undefined} />;
}
