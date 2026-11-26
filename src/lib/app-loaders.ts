// The page loaders the phone app can call through /api/app/data. Each one is
// what a website page loads, shared with that page, so the app shows the
// same thing. Each checks who's asking, as the page does: they run as the
// app's user (src/lib/app-request.ts). Return null for "not found".

import { loadDashboard } from "@/lib/dashboard-page";
import { loadEventForm, loadEventPage, loadEventsTab, loadGroupPage, loadPlanPicker } from "@/lib/events-page";
import { loadInvitationPage } from "@/lib/invitation-page";
import { loadListPage } from "@/lib/list-page";
import { loadAccountPage, loadFollowingTab } from "@/lib/people-page";
import { loadPublicList } from "@/lib/public-list-page";
import { loadSavedItems } from "@/lib/saved-items";
import { getViewer } from "@/lib/viewer";

/** Runs a loader for the signed-in account, or returns null without one. */
async function forViewer<T>(load: (userId: string) => Promise<T>): Promise<T | null> {
  const viewer = await getViewer();
  return viewer ? load(viewer.id) : null;
}

export const APP_LOADERS = {
  dashboard: () => loadDashboard(),
  listPage: (registryId: unknown) => (typeof registryId === "string" ? loadListPage(registryId) : null),
  saved: () => forViewer(loadSavedItems),
  eventsTab: () => loadEventsTab(),
  eventPage: (eventId: unknown) => (typeof eventId === "string" ? loadEventPage(eventId) : null),
  eventForm: (eventId: unknown) => loadEventForm(typeof eventId === "string" ? eventId : null),
  planPicker: () => loadPlanPicker(),
  followingTab: () => loadFollowingTab(),
  accountPage: () => loadAccountPage(),
  groupPage: (groupId: unknown) => (typeof groupId === "string" ? loadGroupPage(groupId) : null),
  // An event's invitation, as a guest sees it (/e/<slug>). `token` is the
  // guest's own RSVP token from their link, or null.
  invitationPage: (slug: unknown, token: unknown) =>
    typeof slug === "string" ? loadInvitationPage(slug, typeof token === "string" && token ? token : null) : null,
  // Someone else's list, as a guest sees it (/r/<slug>).
  // - `items`: the purchase ids the app keeps on the phone, by item id, in
  //   place of the website's gifts cookie. Each counts only when it matches a
  //   live gift on that item.
  // - `eventLink`: { event, token } when the list was opened from a gift link
  //   on the guest's invitation, in place of the website's event guest
  //   cookie. The token is checked against the event's guest list.
  // - `funds`: what this account gave to each gift fund, by fund id, kept on
  //   the phone like the cookie's `funds`. Only used to show "Contributed".
  //   Older app builds don't send it.
  publicList: (slug: unknown, items: unknown, eventLink: unknown, funds?: unknown) =>
    typeof slug === "string"
      ? loadPublicList(slug, { gifts: { items: purchaseIds(items), funds: fundAmounts(funds) }, eventLink: eventLinkFrom(eventLink) })
      : null,
};

/** Purchase ids by item id, keeping only string pairs. */
function purchaseIds(value: unknown): Record<string, string> {
  const ids: Record<string, string> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return ids;
  for (const [itemId, purchaseId] of Object.entries(value)) {
    if (typeof purchaseId === "string") ids[itemId] = purchaseId;
  }
  return ids;
}

/** Amounts by fund id, keeping only positive numbers. */
function fundAmounts(value: unknown): Record<string, number> {
  const amounts: Record<string, number> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return amounts;
  for (const [fundId, amount] of Object.entries(value)) {
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) amounts[fundId] = amount;
  }
  return amounts;
}

/** An event's slug and a guest's RSVP token, when both are strings. */
function eventLinkFrom(value: unknown): { event: string; token: string } | null {
  if (!value || typeof value !== "object") return null;
  const { event, token } = value as { event?: unknown; token?: unknown };
  return typeof event === "string" && event && typeof token === "string" && token ? { event, token } : null;
}
