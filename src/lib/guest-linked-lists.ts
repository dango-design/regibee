// Everyone gives everyone: a list the host linked to the event can belong to
// one of the event's guests, like a host who's also on the guest list and
// linked their own list. Until that guest adds a wish list of their own, the
// linked list is theirs, so it shows on their row in everyone's wish lists
// and in their RSVP's wish list step, instead of as a second row.
//
// No imports, so its test runs on plain Node.

/** A guest's entry, with only the fields this reads and sets. */
interface WishListEntry {
  guestId: string;
  url: string | null;
  registry: { title: string; slug: string } | null;
}

/** A list the host linked, with its owner's email. */
export interface LinkedListWithOwner {
  slug: string;
  title: string;
  ownerEmail: string | null;
}

const normal = (email: string | null | undefined) => email?.trim().toLowerCase() || null;

/**
 * Puts each linked list on the row of the guest whose email is its owner's,
 * when that guest hasn't added a wish list. Each list goes to one guest at
 * most, and never to a second row when it's already someone's wish list.
 * guestEmails maps a guest's id to their email.
 */
export function giveGuestsTheirLinkedLists<T extends WishListEntry>(
  lists: T[],
  linked: LinkedListWithOwner[],
  guestEmails: Map<string, string | null>,
): T[] {
  const used = new Set(lists.flatMap((entry) => (entry.registry ? [entry.registry.slug] : [])));
  return lists.map((entry) => {
    if (entry.url || entry.registry) return entry;
    const email = normal(guestEmails.get(entry.guestId));
    if (!email) return entry;
    const list = linked.find((l) => !used.has(l.slug) && normal(l.ownerEmail) === email);
    if (!list) return entry;
    used.add(list.slug);
    return { ...entry, url: `/r/${list.slug}`, registry: { title: list.title, slug: list.slug } };
  });
}
