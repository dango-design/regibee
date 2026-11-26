import { cache } from "react";
import type { FollowButtonState } from "@/components/follow-button";
import { getBlockState, getFollowStatus } from "@/lib/follows";
import type { GiftProfileViewer } from "@/lib/gift-profile";
import { profileViewer } from "@/lib/list-access";
import { createClient } from "@/utils/supabase/server";

// Whoever's session this request carries, guests' anonymous sessions
// included. getUser asks Supabase's auth server each time, so pages, layouts
// and the top bar share this one call per request instead of making their own.
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// The signed-in account looking at a page. Guests have anonymous sessions, so
// they count as signed out here.
export const getViewer = cache(async () => {
  const user = await getSessionUser();
  return user && !user.is_anonymous ? user : null;
});

export interface ViewerRelation {
  state: FollowButtonState;
  isOwner: boolean;
  hidden: boolean;
  /** The owner follows the viewer, with the viewer's approval. Their button says "Follow back". */
  followsYou: boolean;
}

// How the viewer relates to a profile owner: what their Follow button shows,
// and whether the owner has blocked them (then the profile is hidden from them
// while they're signed in).
export const getViewerRelation = cache(async (ownerId: string): Promise<ViewerRelation> => {
  const viewer = await getViewer();
  if (!viewer) return { state: "signed-out", isOwner: false, hidden: false, followsYou: false };
  if (viewer.id === ownerId) return { state: "none", isOwner: true, hidden: false, followsYou: false };

  const [status, reverse, blocks] = await Promise.all([
    getFollowStatus(viewer.id, ownerId),
    getFollowStatus(ownerId, viewer.id),
    getBlockState(viewer.id, ownerId),
  ]);

  if (blocks.blockedByOther) return { state: "none", isOwner: false, hidden: true, followsYou: false };
  if (blocks.blockedOther) return { state: "blocked", isOwner: false, hidden: false, followsYou: false };
  return { state: status ?? "none", isOwner: false, hidden: false, followsYou: reverse === "approved" };
});

/**
 * How the viewer relates to a person, for the parts of their gift profile
 * they chose to show (visibleGiftProfile in src/lib/gift-profile.ts).
 */
export function giftProfileViewer(
  relation: Pick<ViewerRelation, "state" | "isOwner" | "followsYou">,
): GiftProfileViewer {
  return profileViewer({
    isOwner: relation.isOwner,
    follows: relation.state === "approved",
    followedBack: relation.followsYou,
  });
}
