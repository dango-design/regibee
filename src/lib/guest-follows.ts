// The Follow button beside each guest on an event's guest list: the host's
// list on the event's manage page, and everyone's wishlists on the event's
// own page. The rules for who gets one are in src/lib/guest-follow-rules.ts.
//
// Server-only. These read with the service-role client and take a raw user
// id, so call them only with an id you got from auth. The guests' account ids
// and emails never leave the server: a page gets only the id from the
// profile link of a guest it may offer to follow.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { guestFollow, type GuestFollow } from "@/lib/guest-follow-rules";

export type { GuestFollow } from "@/lib/guest-follow-rules";

interface GuestRef {
  id: string;
  email: string | null;
  /** The guest's account, when a host invited them from the people they follow. */
  profile_id?: string | null;
}

/** Keeps each `in` filter's URL short. A guest list holds up to 300. */
const CHUNK = 100;

/**
 * The confirmed accounts behind these email addresses, by address in
 * lowercase. Empty until 20261124023559_guest_account_lookup.sql has run.
 */
async function accountsByEmail(emails: string[]): Promise<Map<string, string>> {
  if (emails.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.rpc("account_ids_for_emails", { p_emails: emails });
  if (error) return new Map();
  return new Map(((data || []) as { email: string; account_id: string }[]).map((row) => [row.email, row.account_id]));
}

/**
 * The Follow button for each guest who has an account `viewerId` may be
 * shown, by guest id. Guests with no account, the viewer's own row and
 * anyone the rules leave out aren't in the map.
 *
 * `audience` is who's looking: "host" on the manage page, where the host
 * sees the emails of guests they typed in, and "guest" on the event's own
 * page, where people see only each other's names.
 */
export async function guestFollowsFor(
  viewerId: string,
  guests: GuestRef[],
  audience: "host" | "guest",
): Promise<Map<string, GuestFollow>> {
  const emails = [
    ...new Set(guests.filter((g) => !g.profile_id && g.email).map((g) => g.email!.trim().toLowerCase())),
  ];
  const byEmail = await accountsByEmail(emails);

  // Each guest's account, and whether it was matched by an email the host sees.
  const linked = guests.flatMap((g) => {
    const byAddress = !g.profile_id && g.email ? byEmail.get(g.email.trim().toLowerCase()) : undefined;
    const accountId = g.profile_id ?? byAddress;
    if (!accountId || accountId === viewerId) return [];
    return [{ guestId: g.id, accountId, seenBy: audience === "host" && byAddress ? ("email" as const) : ("name" as const) }];
  });
  if (linked.length === 0) return new Map();

  const accountIds = [...new Set(linked.map((l) => l.accountId))];
  const chunks = Array.from({ length: Math.ceil(accountIds.length / CHUNK) }, (_, i) =>
    accountIds.slice(i * CHUNK, (i + 1) * CHUNK),
  );
  // The viewer's follows and blocks are read whole and matched here, instead
  // of filtering by hundreds of ids.
  const [profileRows, { data: following }, { data: followers }, { data: blocks }] = await Promise.all([
    Promise.all(
      chunks.map((ids) =>
        supabaseAdmin.from("profiles").select("id, public_id, discoverable, findable_by_email").in("id", ids),
      ),
    ),
    supabaseAdmin.from("follows").select("followee_id, status").eq("follower_id", viewerId),
    supabaseAdmin.from("follows").select("follower_id").eq("followee_id", viewerId).eq("status", "approved"),
    supabaseAdmin
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
  ]);

  type ProfileRow = { id: string; public_id: string; discoverable: boolean | null; findable_by_email: boolean | null };
  const profiles = new Map(
    profileRows.flatMap(({ data }) => (data || []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const statusById = new Map((following || []).map((f) => [f.followee_id as string, f.status as "pending" | "approved"]));
  const followerIds = new Set((followers || []).map((f) => f.follower_id as string));
  const blockedIds = new Set(
    (blocks || []).map((b) => (b.blocker_id === viewerId ? (b.blocked_id as string) : (b.blocker_id as string))),
  );

  const result = new Map<string, GuestFollow>();
  for (const { guestId, accountId, seenBy } of linked) {
    const profile = profiles.get(accountId);
    if (!profile) continue;
    const follow = guestFollow(
      {
        publicId: profile.public_id,
        discoverable: Boolean(profile.discoverable),
        findableByEmail: Boolean(profile.findable_by_email),
        status: statusById.get(accountId) ?? null,
        followsYou: followerIds.has(accountId),
        blocked: blockedIds.has(accountId),
      },
      seenBy,
    );
    if (follow) result.set(guestId, follow);
  }
  return result;
}
