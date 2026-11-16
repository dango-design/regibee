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
    who: "You and co-managers",
    description: "Only you and your co-managers can open it. The link won't work for anyone else.",
  },
  link: {
    label: "Anyone with the link",
    short: "Link only",
    who: "People you send it to",
    description: "People you send the link to can open it. Search engines won't show it.",
  },
  public: {
    label: "Public",
    short: "Public",
    who: "Anyone can find it",
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

/**
 * Who sees a list on its owner's profile, when it's listed there. Private
 * lists can't be listed.
 */
export const PROFILE_LISTING = {
  link: {
    label: "Show to people who follow me",
    description: "Followers you've approved see it on your profile.",
  },
  public: {
    label: "Show on my profile",
    description: "Anyone who opens your profile sees it.",
  },
} as const;
