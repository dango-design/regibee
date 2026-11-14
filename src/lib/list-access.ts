// Who can open a list, in the words the website and the phone app both use.
// Every list opens for anyone with its link. registries.is_public only adds
// search engines and showing it on a profile to everyone. Shared with the
// phone app (@shared/list-access), so this file has no imports.

export const LIST_ACCESS = {
  link: {
    label: "Only people with the link",
    short: "Link only",
    description: "Search engines can't find it. It opens for anyone you send the link to.",
  },
  public: {
    label: "Public",
    short: "Public",
    description: "Search engines can find it, and it opens for anyone with the link.",
  },
} as const;

export function listAccess(isPublic: boolean) {
  return isPublic ? LIST_ACCESS.public : LIST_ACCESS.link;
}
