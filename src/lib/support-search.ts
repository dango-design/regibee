// What the support team typed in the search box on /support: a list's link,
// a profile's link, or text to match against names, emails and list titles.
// See "Support view" in CLAUDE.md.
//
// Only relative imports of files without imports, so unit tests can load it.

import { publicIdFromPath } from "./profile-link.ts";

export type SupportSearch =
  | { kind: "list"; slug: string }
  | { kind: "profile"; publicId: string }
  | { kind: "text"; text: string };

/** Shorter text matches too much to be useful, and the database refuses it. */
export const SUPPORT_SEARCH_MIN = 2;

const LIST_LINK = /\/r\/([a-z0-9-]+)/i;
const PROFILE_LINK = /\/u\/([a-z0-9-]+)/i;

/** Null when there's nothing to search for. */
export function parseSupportSearch(raw: string | null | undefined): SupportSearch | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  // A pasted link, with or without the site's address in front.
  const list = text.match(LIST_LINK);
  if (list) return { kind: "list", slug: list[1].toLowerCase() };
  const profile = text.match(PROFILE_LINK);
  if (profile) {
    const publicId = publicIdFromPath(profile[1]);
    if (publicId) return { kind: "profile", publicId };
  }

  if (text.length < SUPPORT_SEARCH_MIN) return null;
  return { kind: "text", text: text.slice(0, 200) };
}
