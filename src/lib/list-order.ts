// The order of a person's lists: on their own My registries tab, and on their
// public profile. Each order is a list of registry ids, saved on the profile
// (profiles.list_order and profiles.profile_list_order, from
// 20261128085244_list_order.sql).
//
// The website and the phone app share this file through @shared/*, so it
// imports only other shared files, with relative paths.

import { sortListedRegistries, type ListedRegistry } from "./registry-listing.ts";

/** The most ids an order holds. The database checks the same number. */
export const MAX_LIST_ORDER = 500;

/**
 * Puts lists in a saved order. Lists missing from the order, like a new one,
 * go first, in the order they came in. Ids in the order that match no list,
 * like a deleted one, are skipped.
 */
export function orderLists<T extends { id: string }>(lists: T[], order: readonly string[] | null | undefined): T[] {
  if (!order || order.length === 0) return [...lists];
  const position = new Map(order.map((id, index) => [id, index]));
  const missing = lists.filter((list) => !position.has(list.id));
  const placed = lists
    .filter((list) => position.has(list.id))
    .sort((a, b) => position.get(a.id)! - position.get(b.id)!);
  return [...missing, ...placed];
}

/**
 * The order of the lists on a profile. With no saved order, it's the soonest
 * date first (sortListedRegistries). With one, it's the saved order, and
 * lists missing from it go first, soonest date first.
 */
export function orderProfileLists<T extends ListedRegistry & { id: string }>(
  lists: T[],
  order: readonly string[] | null | undefined,
  today: string,
): T[] {
  return orderLists(sortListedRegistries(lists, today), order);
}

/** Moves one list up or down a place. Returns the same order when it can't move. */
export function moveList(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/**
 * Checks an order sent to the server: a list of ids, each once, only of the
 * lists in `allowed`. Null when it isn't a list of strings.
 */
export function cleanListOrder(input: unknown, allowed: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(input) || !input.every((id) => typeof id === "string")) return null;
  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of input as string[]) {
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  return order.slice(0, MAX_LIST_ORDER);
}
