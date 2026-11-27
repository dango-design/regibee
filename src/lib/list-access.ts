// Who can open a list, in the words the website and the phone app both use.
// Shared with the phone app (@shared/list-access), so this file has no imports.
//
// The database keeps this as two columns on registries:
// - is_private: only the owner and co-managers can open it.
// - is_public: search engines can show it, and anyone who opens the owner's
//   profile sees it there if it's listed.
// Neither one set means anyone with the link can open it. Both can't be set.

export type ListVisibility = "private" | "link" | "public";

export const LIST_VISIBILITIES: readonly ListVisibility[] = ["private", "link", "public"];

export const LIST_ACCESS = {
  private: {
    label: "Private",
    short: "Private",
    description: "Only you and co-managers can open it.",
  },
  link: {
    label: "Anyone with the link",
    short: "Link only",
    description: "Anyone with the link can open it. Search engines won't show it.",
  },
  public: {
    label: "Public",
    short: "Public",
    description: "Anyone can open it, and search engines can show it.",
  },
} as const;

/** New lists start here. */
export const DEFAULT_LIST_VISIBILITY: ListVisibility = "link";

export function listVisibility(list: { is_public: boolean; is_private?: boolean | null }): ListVisibility {
  if (list.is_private) return "private";
  return list.is_public ? "public" : "link";
}

/** The database columns for a choice. */
export function visibilityColumns(visibility: ListVisibility): { is_private: boolean; is_public: boolean } {
  return { is_private: visibility === "private", is_public: visibility === "public" };
}

export function parseListVisibility(value: unknown): ListVisibility | null {
  return LIST_VISIBILITIES.includes(value as ListVisibility) ? (value as ListVisibility) : null;
}

export function listAccess(visibility: ListVisibility) {
  return LIST_ACCESS[visibility];
}

// ── Who sees a list on its owner's profile ────────────────────────────────
//
// This is separate from who can open the list. It only decides who finds the
// list on the profile: anyone with a link-only or public list's link can
// still open it.
//
// The database keeps it as two columns on registries:
// - listed_on_profile: whether the list is on the profile at all.
// - profile_audience: 'friends', 'followers', 'everyone' or null. Null means
//   what it meant before the column existed: everyone for a public list,
//   followers for a link-only one.

/**
 * Who sees a list on its owner's profile. Each one includes the ones before
 * it: friends are followers too.
 * - hidden: it isn't on the profile.
 * - friends: people the owner follows who also follow the owner, with both
 *   follows approved.
 * - followers: followers the owner approved.
 * - everyone: anyone who opens the profile. Only for public lists.
 */
export type ProfileAudience = "hidden" | "friends" | "followers" | "everyone";

export const PROFILE_AUDIENCES: readonly ProfileAudience[] = ["hidden", "friends", "followers", "everyone"];

// `description` is the hint under the choice. Only Friends needs one: the
// other labels say it all.
export const PROFILE_AUDIENCE = {
  hidden: {
    label: "Nobody",
    short: "not on your profile",
    description: "",
  },
  friends: {
    label: "Friends",
    short: "friends see it on your profile",
    description: "Friends are people you follow who follow you back.",
  },
  followers: {
    label: "Followers",
    short: "followers see it on your profile",
    description: "",
  },
  everyone: {
    label: "Everyone",
    short: "anyone sees it on your profile",
    description: "",
  },
} as const;

/** Said with the friends and followers choices, so nobody reads them as who can open the list. */
export const PROFILE_AUDIENCE_LINK_NOTE = "Anyone with the link can still open it.";

/**
 * The choices for a list people open this way. A private list can't be on a
 * profile. A link-only list can't show to everyone, or the profile would hand
 * its link to people it was never sent to.
 */
export function profileAudienceChoices(visibility: ListVisibility): ProfileAudience[] {
  if (visibility === "private") return ["hidden"];
  if (visibility === "link") return ["hidden", "friends", "followers"];
  return ["hidden", "friends", "followers", "everyone"];
}

/** Who a list on a profile shows to when its owner hasn't chosen. */
export function defaultProfileAudience(visibility: ListVisibility): ProfileAudience {
  if (visibility === "private") return "hidden";
  return visibility === "public" ? "everyone" : "followers";
}

/** The nearest choice this kind of list allows. */
export function clampProfileAudience(audience: ProfileAudience, visibility: ListVisibility): ProfileAudience {
  if (visibility === "private") return "hidden";
  if (audience === "everyone" && visibility !== "public") return "followers";
  return audience;
}

export function parseProfileAudience(value: unknown): ProfileAudience | null {
  return PROFILE_AUDIENCES.includes(value as ProfileAudience) ? (value as ProfileAudience) : null;
}

/** Who sees this list on its owner's profile, from its saved columns. */
export function profileAudience(list: {
  is_public: boolean;
  is_private?: boolean | null;
  listed_on_profile?: boolean | null;
  profile_audience?: string | null;
}): ProfileAudience {
  const visibility = listVisibility(list);
  if (!list.listed_on_profile || visibility === "private") return "hidden";
  const saved = parseProfileAudience(list.profile_audience);
  if (!saved || saved === "hidden") return defaultProfileAudience(visibility);
  return clampProfileAudience(saved, visibility);
}

/** The database columns for a choice. */
export function profileAudienceColumns(
  audience: ProfileAudience,
  visibility: ListVisibility,
): { listed_on_profile: boolean; profile_audience: Exclude<ProfileAudience, "hidden"> | null } {
  const allowed = clampProfileAudience(audience, visibility);
  return allowed === "hidden"
    ? { listed_on_profile: false, profile_audience: null }
    : { listed_on_profile: true, profile_audience: allowed };
}

/**
 * The form fields updateRegistry and createRegistry read for a choice.
 * listedOnProfile is the older field, kept so a server that doesn't know
 * profileAudience yet still puts the list on the profile or takes it off.
 */
export function profileAudienceFields(
  audience: ProfileAudience,
  visibility: ListVisibility,
): { profileAudience: ProfileAudience; listedOnProfile: string } {
  const allowed = clampProfileAudience(audience, visibility);
  return { profileAudience: allowed, listedOnProfile: String(allowed !== "hidden") };
}

/**
 * The columns to save when a manager changes who can open a list, and maybe
 * who sees it on the profile. The Settings page (updateRegistry) and the
 * Share panel (updateListSharing) both use this, so they follow the same
 * rules:
 * - A private list comes off the profile, whoever makes it private.
 * - Only the owner chooses who sees it on the profile, since it shows under
 *   their name. A co-manager's choice is ignored.
 * - The choice is clamped to what the access allows. A list that stops being
 *   public with no new choice keeps its saved one: profileAudience reads
 *   "everyone" as followers then.
 * - Older phone app builds only send `listedOnProfile`. That turns the
 *   listing on or off and leaves the saved choice alone.
 */
export function sharingColumns(change: {
  visibility: ListVisibility;
  isOwner: boolean;
  audience?: ProfileAudience | null;
  listedOnProfile?: boolean | null;
}): {
  is_private: boolean;
  is_public: boolean;
  listed_on_profile?: boolean;
  profile_audience?: Exclude<ProfileAudience, "hidden"> | null;
} {
  const { visibility, isOwner, audience, listedOnProfile } = change;
  const columns = visibilityColumns(visibility);
  if (visibility === "private") return { ...columns, listed_on_profile: false };
  if (isOwner && audience) return { ...columns, ...profileAudienceColumns(audience, visibility) };
  if (isOwner && listedOnProfile != null) return { ...columns, listed_on_profile: listedOnProfile };
  return columns;
}

/**
 * What to say before changing who can open a list, or null when the change
 * needs no warning. The change waits until the person presses `confirm`.
 * - Going private: people with the link can't open it, and it comes off its
 *   events (and the wishlists guests added it as), its groups and the
 *   profile. The database does that (20261115084541_private_lists.sql), and
 *   nothing puts it back if the list is opened again.
 * - Going public: search engines can show it.
 */
export function accessChangeWarning(
  from: ListVisibility,
  to: ListVisibility,
  linked: {
    /** The names of the events the list is on. */
    events: string[];
    /** It shows on the owner's profile now. */
    onProfile: boolean;
    /** The person changing it is the owner, so it's "your profile". */
    isOwner: boolean;
  },
): { title: string; text: string; confirm: string } | null {
  if (from === to) return null;
  if (to === "private") {
    const events =
      linked.events.length > 2
        ? [linked.events[0], `${linked.events.length - 1} other events`]
        : linked.events;
    const places = [
      ...events,
      ...(linked.onProfile ? [linked.isOwner ? "your profile" : "the owner's profile"] : []),
      "any groups it's shared with",
    ];
    return {
      title: "Make this list private?",
      text: `People with the link won't be able to open it, and it comes off ${joinWords(places)}. Opening it again later won't put it back.`,
      confirm: "Make private",
    };
  }
  if (to === "public") {
    return {
      title: "Make this list public?",
      text: "Search engines can show it, so anyone can find it and open it.",
      confirm: "Make public",
    };
  }
  return null;
}

/**
 * What to say after a change to who can open a list moved who sees it on the
 * profile, or null. Only a public list can show to everyone, so one that
 * stops being public shows to followers instead.
 */
export function profileChangeNotice(
  before: { visibility: ListVisibility; audience: ProfileAudience },
  after: ListVisibility,
  isOwner: boolean,
): string | null {
  if (before.audience !== "everyone" || after !== "link") return null;
  return isOwner
    ? "Now only followers see it on your profile. Only public lists can show to everyone."
    : "Now only the owner's followers see it on their profile. Only public lists can show to everyone.";
}

/** "a", "a and b", "a, b and c". */
function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * How someone looking at a profile relates to its owner.
 * - friend: an approved follower the owner also follows, approved.
 * - follower: an approved follower the owner doesn't follow back.
 * - other: everyone else, signed in or not.
 */
export type ProfileViewer = "owner" | "friend" | "follower" | "other";

export function profileViewer(relation: {
  isOwner: boolean;
  /** The viewer's follow of the owner is approved. */
  follows: boolean;
  /** The owner's follow of the viewer is approved. */
  followedBack: boolean;
}): ProfileViewer {
  if (relation.isOwner) return "owner";
  if (!relation.follows) return "other";
  return relation.followedBack ? "friend" : "follower";
}

/** Whether this viewer sees a list with this audience on its owner's profile. */
export function seesOnProfile(audience: ProfileAudience, viewer: ProfileViewer): boolean {
  if (audience === "hidden") return false;
  if (viewer === "owner") return true;
  if (audience === "everyone") return true;
  if (audience === "followers") return viewer === "follower" || viewer === "friend";
  return viewer === "friend";
}
