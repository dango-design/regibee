// The page loaders the phone app can call through /api/app/data. Each one is
// what a website page loads, shared with that page, so the app shows the
// same thing. Each checks who's asking, as the page does: they run as the
// app's user (src/lib/app-request.ts). Return null for "not found".

import { loadDashboard } from "@/lib/dashboard-page";
import { loadEventForm, loadEventPage, loadEventsTab, loadGroupPage, loadPlanPicker } from "@/lib/events-page";
import { loadListPage } from "@/lib/list-page";
import { loadAccountPage, loadFollowingTab } from "@/lib/people-page";
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
};
