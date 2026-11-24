// Reads for a profile's "Events together" section. The rules for which
// events count are in src/lib/shared-events.ts.
//
// Server-only. These read with the service-role client and take raw account
// ids, so call them only with the viewer's id from auth and the id of the
// profile being shown. Guest rows, emails and the other person's replies stay
// here: the page gets only the events both people go to, each with the
// viewer's own link.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatEventTime, type EventDetails } from "@/lib/events";
import {
  eventParts,
  sharedEventIds,
  sortSharedEvents,
  type EventParts,
  type PartGuestRow,
  type SharedEvent,
} from "@/lib/shared-events";

/** An account, with its email address only once that's confirmed. */
interface Account {
  id: string;
  email: string | null;
}

/** Keeps the `in` filter's URL short. */
const CHUNK = 100;

/**
 * The account's part in every event it hosts, co-hosts or is a guest at. A
 * guest row is the account's when it's linked to it, or when it has the
 * account's confirmed email address and no other account
 * (listInvitedEventsForUser matches invitations the same way).
 */
async function partsFor(account: Account): Promise<EventParts> {
  const fields = "event_id, rsvp_status, token";
  // Guest emails are stored lowercased.
  const email = account.email?.trim().toLowerCase() || null;
  const [byAccount, byEmail, coHosted, owned] = await Promise.all([
    supabaseAdmin.from("event_guests").select(fields).eq("profile_id", account.id),
    email
      ? supabaseAdmin.from("event_guests").select(fields).eq("email", email).is("profile_id", null)
      : Promise.resolve({ data: [] as PartGuestRow[], error: null }),
    supabaseAdmin.from("event_hosts").select("event_id").eq("user_id", account.id),
    supabaseAdmin.from("events").select("id").eq("owner_id", account.id),
  ]);
  const error = byAccount.error ?? byEmail.error ?? coHosted.error ?? owned.error;
  if (error) console.error("[shared-events] Failed to read an account's events:", error);

  return eventParts(
    [...(coHosted.data || []).map((h) => h.event_id as string), ...(owned.data || []).map((e) => e.id as string)],
    // Rows linked to the account come first and win.
    [...(byAccount.data || []), ...(byEmail.data || [])] as PartGuestRow[],
  );
}

/**
 * The events `viewer` and `person` both went to or are going to, as the
 * viewer sees them on the person's profile: upcoming first, then past.
 * `today` is YYYY-MM-DD.
 */
export async function listSharedEvents(viewer: Account, person: Account, today: string): Promise<SharedEvent[]> {
  if (viewer.id === person.id) return [];
  const [mine, theirs] = await Promise.all([partsFor(viewer), partsFor(person)]);
  const ids = sharedEventIds(mine, theirs);
  if (ids.length === 0) return [];

  type Row = Pick<EventDetails, "id" | "slug" | "title" | "event_type" | "event_date" | "start_time" | "end_time" | "time_zone">;
  const chunks = Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, i) => ids.slice(i * CHUNK, (i + 1) * CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabaseAdmin
        .from("events")
        .select("id, slug, title, event_type, event_date, start_time, end_time, time_zone")
        .in("id", chunk),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed) console.error("[shared-events] Failed to read shared events:", failed.error);

  const events = results.flatMap((result) => (result.data || []) as Row[]).map((event): SharedEvent => {
    const token = mine.tokens.get(event.id);
    return {
      id: event.id,
      title: event.title,
      eventType: event.event_type,
      eventDate: event.event_date,
      time: formatEventTime(event),
      // A host opens the event's own page. A guest opens the invitation on
      // their own guest link, so it shows their RSVP.
      href:
        mine.parts.get(event.id) === "host" || !token
          ? `/dashboard/events/${event.id}`
          : `/e/${event.slug}?g=${encodeURIComponent(token)}`,
    };
  });
  return sortSharedEvents(events, today);
}
