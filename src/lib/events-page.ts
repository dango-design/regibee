// What the Events tab, an event's page, the event form, the "Start something
// new" picker and a group's page show. The website's pages and the phone app
// (src/app/api/app/data) both load them here, so they show the same thing.
//
// Server-only: these read with the service-role client after checking who's
// asking, the same way the pages always have.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getViewer } from "@/lib/viewer";
import {
  eventTypeLabel,
  exchangeStatus,
  formatEventTime,
  formatShortEventDate,
  guestForHost,
  summarizeRsvps,
} from "@/lib/events";
import {
  getEventForManager,
  getEventGuests,
  getEventHosts,
  getEventMessages,
  getEventRegistries,
  getExchangeExclusions,
  getGiftExchange,
  getHostInvites,
  getManageableRegistries,
  getPendingListRequests,
  getSignupSheet,
  listEventsForUser,
  listInvitedEventsForUser,
  listLinkedEventsForUser,
  listOtherEventsForCopy,
} from "@/lib/events-server";
import { getGroupForOwner, getGroupMembers, listGroupEvents, listGroupRegistries, listGroupsForOwner } from "@/lib/groups-server";
import { listFollowedAccounts, mutualFollowIds } from "@/lib/follows";
import { displayName } from "@/lib/profile-link";
import { showEmailTo } from "@/lib/guest-emails";
import { guestFollowsFor } from "@/lib/guest-follows";
import { MESSAGE_AUDIENCES, messageRecipients, type MessageAudience } from "@/lib/event-updates";
import { storedQuestions } from "@/lib/rsvp-questions";
import { claimsByGuest, describeClaim, hidesAddressUntilSignup, signupRowsForHost } from "@/lib/signups";
import type {
  EventFormData,
  EventPageData,
  EventsTabCard,
  EventsTabData,
  EventsTabInvite,
  GroupPageData,
  PlanPickerData,
} from "@/lib/events-page-types";

export type * from "@/lib/events-page-types";

/**
 * The Events tab: events you host, events you're invited to, other people's
 * events that link your lists, and your groups.
 */
export async function loadEventsTab(): Promise<EventsTabData | null> {
  // Guests (anonymous sessions) don't have events.
  const viewer = await getViewer();
  if (!viewer) return null;

  const [events, invitedEvents, linkedEvents, groups] = await Promise.all([
    listEventsForUser(viewer.id),
    // Invitations to the account's email count only once it's confirmed.
    listInvitedEventsForUser({ id: viewer.id, email: viewer.email_confirmed_at ? (viewer.email ?? null) : null }),
    listLinkedEventsForUser(viewer.id),
    listGroupsForOwner(viewer.id),
  ]);
  // YYYY-MM-DD in UTC, like the other dashboard tabs.
  const today = new Date().toISOString().slice(0, 10);

  const upcoming: EventsTabCard[] = [];
  const past: EventsTabCard[] = [];
  for (const event of events) {
    const card: EventsTabCard = {
      id: event.id,
      slug: event.slug,
      title: event.title,
      eventType: event.event_type,
      eventDate: event.event_date,
      time: formatEventTime(event),
      imageUrl: event.image_url,
      summary: summarizeRsvps(event.event_guests),
      coHost: event.owner_id !== viewer.id,
    };
    if (event.event_date && event.event_date < today) past.push(card);
    else upcoming.push(card);
  }
  const invited: EventsTabInvite[] = [];
  const invitedPast: EventsTabInvite[] = [];
  for (const event of invitedEvents) {
    const invite: EventsTabInvite = {
      id: event.id,
      slug: event.slug,
      title: event.title,
      eventType: event.event_type,
      eventDate: event.event_date,
      time: formatEventTime(event),
      imageUrl: event.image_url,
      hostedBy: event.hosted_by,
      rsvp: event.rsvp_status,
      guestToken: event.guest_token,
    };
    if (event.event_date && event.event_date < today) invitedPast.push(invite);
    else invited.push(invite);
  }

  // The lists come soonest first, with no-date events last. Past events read
  // better most recent first.
  past.reverse();
  invitedPast.reverse();

  // An event you're invited to shows under Invited, with your reply, even
  // when it also links your list.
  const invitedIds = new Set(invitedEvents.map((event) => event.id));
  const linked = linkedEvents
    .filter((event) => !event.event_date || event.event_date >= today)
    .filter((event) => !invitedIds.has(event.id))
    .map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      dateText: event.event_date ? formatShortEventDate(event.event_date) : null,
      registryTitles: event.registryTitles,
    }));

  return { upcoming, past, invited, invitedPast, linked, groups, today };
}

/** An event's manage page, for its owner and co-hosts. Null for anyone else. */
export async function loadEventPage(eventId: string): Promise<EventPageData | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const found = await getEventForManager(eventId, viewer.id);
  if (!found) return null;
  const { event, isOwner } = found;

  const [allGuests, registries, exchange, exclusions, hosts, invites, copySources, groups, listRequests, signupSheet, messages, followed] =
    await Promise.all([
      getEventGuests(event.id),
      getEventRegistries(event.id),
      getGiftExchange(event.id),
      getExchangeExclusions(event.id),
      getEventHosts(event),
      getHostInvites(event.id),
      listOtherEventsForCopy(viewer.id, event.id),
      listGroupsForOwner(viewer.id),
      getPendingListRequests(event.id),
      getSignupSheet(event.id),
      getEventMessages(event.id, 5),
      listFollowedAccounts(viewer.id),
    ]);
  // A guest invited from a follow shows their email only to a host they
  // follow both ways (src/lib/guest-emails.ts).
  const [mutualIds, follows] = await Promise.all([
    mutualFollowIds(
      viewer.id,
      allGuests.map((g) => g.profile_id),
    ),
    // The Follow button beside each guest who has an account this host may
    // be shown (src/lib/guest-follow-rules.ts).
    guestFollowsFor(viewer.id, allGuests, "host"),
  ]);
  const guestAccounts = new Set(allGuests.map((g) => g.profile_id).filter(Boolean));
  // Worked out before the guests are trimmed for the host, since it needs the pairs.
  const status = exchange ? exchangeStatus(allGuests, exchange) : null;
  // What each guest signed up for, as their row on the guest list shows it.
  const signupsByGuest = signupSheet
    ? Object.fromEntries([...claimsByGuest(signupSheet)].map(([id, claims]) => [id, claims.map(describeClaim)]))
    : undefined;
  // How many guests with an email each "Message guests" choice reaches.
  const audienceCounts = Object.fromEntries(
    (Object.keys(MESSAGE_AUDIENCES) as MessageAudience[]).map((a) => [a, messageRecipients(allGuests, a).length]),
  ) as Record<MessageAudience, number>;

  return {
    event,
    isOwner,
    viewerId: viewer.id,
    replyToEmail: viewer.email ?? null,
    // The host never sees who drew whom, or the wishlists and addresses guests
    // were told only their Secret Santa sees.
    guests: allGuests.map((g) => ({
      ...showEmailTo(guestForHost(g), viewer.id, mutualIds),
      follow: follows.get(g.id) ?? null,
    })),
    registries: registries.map((r) => ({ id: r.id, slug: r.slug, title: r.title, honoree: r.honoree })),
    exchange,
    exchangeStatus: status,
    exclusions,
    hosts,
    invites,
    copySources,
    groups,
    listRequests,
    signupSheet: signupSheet ? { sheet: signupSheet.sheet, rows: signupRowsForHost(signupSheet, allGuests) } : null,
    signupsByGuest,
    mealTrain: hidesAddressUntilSignup(event.event_type),
    questions: storedQuestions(event.rsvp_questions),
    audienceCounts,
    messages,
    time: formatEventTime(event),
    typeLabel: eventTypeLabel(event.event_type),
    followedPeople: followed.map((person) => ({
      publicId: person.public_id,
      name: displayName(person),
      mutual: person.mutual,
      onList: guestAccounts.has(person.id),
    })),
  };
}

/**
 * The event form: the lists you could link, and for an existing event, its
 * details, linked lists and gift exchange. Null when you can't edit the event.
 */
export async function loadEventForm(eventId?: string | null): Promise<EventFormData | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  if (!eventId) return { registries: await getManageableRegistries(viewer.id), event: null, linkedRegistries: [], exchange: null };

  const found = await getEventForManager(eventId, viewer.id);
  if (!found) return null;
  const [registries, linked, exchange] = await Promise.all([
    getManageableRegistries(viewer.id),
    getEventRegistries(found.event.id),
    getGiftExchange(found.event.id),
  ]);
  return {
    registries,
    event: found.event,
    linkedRegistries: linked.map((r) => ({ id: r.id, title: r.title, honoree: r.honoree })),
    exchange,
  };
}

/** "Start something new": your first name, for suggested titles, and the lists you can link. */
export async function loadPlanPicker(): Promise<PlanPickerData | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const [{ data: profile }, myLists] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name").eq("id", viewer.id).maybeSingle(),
    getManageableRegistries(viewer.id),
  ]);
  const myName = ((profile?.full_name as string | null) ?? "").trim().split(/\s+/)[0] ?? "";
  return { myName, myLists };
}

/** A group's page. Only its owner can open it. */
export async function loadGroupPage(groupId: string): Promise<GroupPageData | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const group = await getGroupForOwner(groupId, viewer.id);
  if (!group) return null;

  const [members, groupEvents, sharedLists] = await Promise.all([
    getGroupMembers(group.id),
    listGroupEvents(group.id),
    listGroupRegistries(group.id),
  ]);
  const mutualIds = await mutualFollowIds(
    viewer.id,
    members.map((m) => m.profile_id),
  );
  // Only events this person still hosts. A co-host who was removed doesn't
  // keep seeing the event here.
  const hosted = await Promise.all(groupEvents.map((e) => getEventForManager(e.id, viewer.id)));
  return {
    group: { id: group.id, name: group.name },
    members: members.map((m) => showEmailTo({ id: m.id, name: m.name, email: m.email, profile_id: m.profile_id }, viewer.id, mutualIds)),
    events: groupEvents.filter((_, index) => hosted[index] !== null),
    sharedLists,
  };
}
