// Whether an event's guest list may offer Follow beside a guest, and what the
// button says. The Follow button gives away that the guest has a Regibee
// account, and holds the id from their profile link, so it shows only where
// the viewer could have found that account anyway.
//
// This file has no imports, so the server and tests can both use it. The
// reads are in src/lib/guest-follows.ts.

/** How the viewer follows a guest. Sent to the page with the guest. */
export interface GuestFollow {
  /** The id from the guest's profile link, for the follow actions. */
  publicId: string;
  state: "none" | "pending" | "approved";
  /** The guest follows the viewer, with the viewer's approval. */
  followsYou: boolean;
}

/** What the server knows about a guest's account and the viewer. */
export interface GuestAccount {
  publicId: string;
  /** "Show me in people search": signed-in people can find them by name. */
  discoverable: boolean;
  /** "Let people find me by my email address." */
  findableByEmail: boolean;
  /** The viewer's follow of this account, if any. */
  status: "pending" | "approved" | null;
  /** The account follows the viewer, approved. */
  followsYou: boolean;
  /** Either one blocked the other. */
  blocked: boolean;
}

/**
 * How the viewer came to see the guest:
 * - "email": a host looking at a guest whose email address they can see. It's
 *   the same as typing that address into people search, so the account's
 *   email choice decides.
 * - "name": everyone else, who sees only the guest's name: other guests, and
 *   a host looking at a guest whose email is private. The account's
 *   people-search choice decides.
 */
export type GuestSeenBy = "email" | "name";

/**
 * The Follow button for one guest, or null for none. Two people who already
 * follow, or asked to, see where that stands whatever the account's choices:
 * each already has the other's profile.
 */
export function guestFollow(account: GuestAccount, seenBy: GuestSeenBy): GuestFollow | null {
  if (account.blocked) return null;
  const known = account.status !== null || account.followsYou;
  const findable = seenBy === "email" ? account.findableByEmail : account.discoverable;
  if (!known && !findable) return null;
  return { publicId: account.publicId, state: account.status ?? "none", followsYou: account.followsYou };
}
