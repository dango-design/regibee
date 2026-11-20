// "Coming up" on the My registries tab: the next few events, with how many
// days are left until each. The Events tab lists them all, but it's easy to
// miss, so the first tab shows what's soonest.
//
// Only type imports of shareable files, so the phone app can use it too.

import type { DashboardEvent } from "./dashboard-page-types";

/** How many events "Coming up" shows. One row of cards on a wide screen. */
export const UPCOMING_EVENTS_LIMIT = 3;

/** An event before it's picked: it may have no date, or one that's passed. */
export type UpcomingEventCandidate = Omit<DashboardEvent, "eventDate"> & { eventDate: string | null };

/**
 * The soonest events from `today` on, at most `limit`. Events with no date
 * are left out, since there's nothing to count down to; the Events tab still
 * lists them. An event that shows up twice keeps its first entry, so pass the
 * ones the user hosts first.
 */
export function pickUpcomingEvents(
  events: UpcomingEventCandidate[],
  today: string,
  limit = UPCOMING_EVENTS_LIMIT,
): DashboardEvent[] {
  const seen = new Set<string>();
  const upcoming: DashboardEvent[] = [];
  for (const event of events) {
    if (!event.eventDate || event.eventDate < today || seen.has(event.id)) continue;
    seen.add(event.id);
    upcoming.push({ ...event, eventDate: event.eventDate });
  }
  return upcoming
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.title.localeCompare(b.title))
    .slice(0, limit);
}
